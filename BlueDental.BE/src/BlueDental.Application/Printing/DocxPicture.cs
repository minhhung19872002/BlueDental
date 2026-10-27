using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;

namespace BlueDental.Printing;

/// <summary>
/// Pictures put into a filled template. A floating one takes the place of the
/// one floating shape on the page (a box), so moving it is a Word edit, not a
/// code change; it keeps the box's anchor and centre and floats in front of
/// the text, so the template's own layout does not move. An inline one goes
/// on the blank lines above a line of text, such as a signature above the
/// signer's name.
/// </summary>
public static class DocxPicture
{
    private const long EmuPerMillimetre = 36_000;
    private const string ShapeUri = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";

    /// <summary>Swaps the box for a square PNG, <paramref name="growMm"/> larger on every side around the box's centre.</summary>
    public static byte[] ReplaceBox(byte[] docx, byte[] png, double growMm, string name) =>
        EditBox(docx, (main, box) =>
        {
            var relationshipId = AddImage(main, png);
            var anchor = box.Descendants<DW.Anchor>().First();
            var extent = anchor.Extent ?? throw new InvalidDataException("The box has no size.");
            var size = Math.Max(extent.Cx!.Value, extent.Cy!.Value) + 2 * Emu(growMm);
            var horizontal = (DW.HorizontalPosition)anchor.HorizontalPosition!.CloneNode(true);
            var vertical = (DW.VerticalPosition)anchor.VerticalPosition!.CloneNode(true);
            Shift(horizontal.PositionOffset, (extent.Cx.Value - size) / 2);
            Shift(vertical.PositionOffset, (extent.Cy.Value - size) / 2);

            box.InsertAfterSelf(Anchored(relationshipId, NextPictureId(main), name, horizontal, vertical, size));
            box.Remove();
        });

    /// <summary>Drops the box: nothing goes in its place on this copy.</summary>
    public static byte[] RemoveBox(byte[] docx) => EditBox(docx, (_, box) => box.Remove());

    /// <summary>
    /// Puts a PNG, centred and no larger than <paramref name="maxWidthMm"/> ×
    /// <paramref name="maxHeightMm"/>, in place of the blank lines right above
    /// the paragraph that reads <paramref name="text"/> — the room the template
    /// leaves for a hand signature — so the sheet keeps about its height.
    /// </summary>
    public static byte[] PlaceAbove(
        byte[] docx, string text, byte[] png, double maxWidthMm, double maxHeightMm, string name) =>
        Edit(docx, main =>
        {
            var target = Body(main).Descendants<Paragraph>().FirstOrDefault(p => p.InnerText.Contains(text))
                ?? throw new InvalidDataException($"The template has no line reading {text}.");

            var blanks = new List<Paragraph>();
            for (var previous = target.PreviousSibling<Paragraph>();
                 previous != null && IsBlank(previous);
                 previous = previous.PreviousSibling<Paragraph>())
            {
                blanks.Add(previous);
            }

            var (width, height) = Fit(PngSize(png), Emu(maxWidthMm), Emu(maxHeightMm));
            var properties = blanks.LastOrDefault()?.ParagraphProperties?.CloneNode(true) as ParagraphProperties
                ?? new ParagraphProperties(new Justification { Val = JustificationValues.Center });
            target.InsertBeforeSelf(new Paragraph(
                properties,
                new Run(Inline(AddImage(main, png), NextPictureId(main), name, width, height))));
            blanks.ForEach(p => p.Remove());
        });

    private static bool IsBlank(Paragraph paragraph) =>
        string.IsNullOrWhiteSpace(paragraph.InnerText) && !paragraph.Descendants<Drawing>().Any();

    /// <summary>Pixel size from the PNG's IHDR chunk, which always comes first.</summary>
    private static (long Width, long Height) PngSize(byte[] png)
    {
        if (png.Length < 24)
        {
            throw new InvalidDataException("Not a PNG.");
        }

        static long BigEndian(byte[] b, int at) => ((long)b[at] << 24) | ((long)b[at + 1] << 16) | ((long)b[at + 2] << 8) | b[at + 3];
        return (BigEndian(png, 16), BigEndian(png, 20));
    }

    private static (long Width, long Height) Fit((long Width, long Height) pixels, long maxWidth, long maxHeight)
    {
        var scale = Math.Min(
            (double)maxWidth / Math.Max(1, pixels.Width),
            (double)maxHeight / Math.Max(1, pixels.Height));
        return ((long)(pixels.Width * scale), (long)(pixels.Height * scale));
    }

    private static string AddImage(MainDocumentPart main, byte[] png)
    {
        var imagePart = main.AddImagePart(ImagePartType.Png);
        using (var image = new MemoryStream(png))
        {
            imagePart.FeedData(image);
        }

        return main.GetIdOfPart(imagePart);
    }

    private static uint NextPictureId(MainDocumentPart main) =>
        (uint)(main.Document.Descendants<DW.DocProperties>().Count() + 1000);

    private static byte[] EditBox(byte[] docx, Action<MainDocumentPart, OpenXmlElement> edit) =>
        Edit(docx, main => edit(main, Box(Body(main))));

    private static byte[] Edit(byte[] docx, Action<MainDocumentPart> edit)
    {
        using var stream = new MemoryStream();
        stream.Write(docx);

        using (var document = WordprocessingDocument.Open(stream, isEditable: true))
        {
            edit(document.MainDocumentPart ?? throw new InvalidDataException("The document has no body."));
        }

        return stream.ToArray();
    }

    private static Body Body(MainDocumentPart main) =>
        main.Document.Body ?? throw new InvalidDataException("The document has no body.");

    /// <summary>
    /// The floating shape in the body, whole: Word writes it as mc:AlternateContent
    /// with a VML fallback, and both halves have to go.
    /// </summary>
    private static OpenXmlElement Box(Body body)
    {
        var shapes = body.Descendants<DW.Anchor>()
            .Where(a => a.GetFirstChild<A.Graphic>()?.GraphicData?.Uri?.Value == ShapeUri)
            .ToList();
        if (shapes.Count != 1)
        {
            throw new InvalidDataException(
                $"The template must hold exactly one box marking where the picture goes; it holds {shapes.Count}.");
        }

        var anchor = shapes[0];
        return anchor.Ancestors<AlternateContent>().FirstOrDefault()
            ?? (OpenXmlElement)anchor.Ancestors<Drawing>().First();
    }

    private static void Shift(DW.PositionOffset? offset, long by)
    {
        if (offset == null || !long.TryParse(offset.Text, out var at))
        {
            throw new InvalidDataException("The box must be placed by offset, not by alignment.");
        }

        offset.Text = (at + by).ToString();
    }

    private static long Emu(double millimetres) => (long)(millimetres * EmuPerMillimetre);

    private static Drawing Anchored(
        string relationshipId, uint id, string name,
        DW.HorizontalPosition horizontal, DW.VerticalPosition vertical, long size) =>
        new(new DW.Anchor(
            new DW.SimplePosition { X = 0, Y = 0 },
            horizontal,
            vertical,
            new DW.Extent { Cx = size, Cy = size },
            new DW.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
            new DW.WrapNone(),
            new DW.DocProperties { Id = id, Name = name },
            new DW.NonVisualGraphicFrameDrawingProperties(new A.GraphicFrameLocks { NoChangeAspect = true }),
            Graphic(relationshipId, name, size, size))
        {
            DistanceFromTop = 0,
            DistanceFromBottom = 0,
            DistanceFromLeft = 0,
            DistanceFromRight = 0,
            SimplePos = false,
            RelativeHeight = 251_659_264,
            BehindDoc = false,
            Locked = false,
            LayoutInCell = true,
            AllowOverlap = true
        });

    private static Drawing Inline(string relationshipId, uint id, string name, long width, long height) =>
        new(new DW.Inline(
            new DW.Extent { Cx = width, Cy = height },
            new DW.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
            new DW.DocProperties { Id = id, Name = name },
            new DW.NonVisualGraphicFrameDrawingProperties(new A.GraphicFrameLocks { NoChangeAspect = true }),
            Graphic(relationshipId, name, width, height))
        {
            DistanceFromTop = 0,
            DistanceFromBottom = 0,
            DistanceFromLeft = 0,
            DistanceFromRight = 0
        });

    private static A.Graphic Graphic(string relationshipId, string name, long width, long height) =>
        new(new A.GraphicData(
            new PIC.Picture(
                new PIC.NonVisualPictureProperties(
                    new PIC.NonVisualDrawingProperties { Id = 0, Name = name + ".png" },
                    new PIC.NonVisualPictureDrawingProperties()),
                new PIC.BlipFill(
                    new A.Blip { Embed = relationshipId },
                    new A.Stretch(new A.FillRectangle())),
                new PIC.ShapeProperties(
                    new A.Transform2D(
                        new A.Offset { X = 0, Y = 0 },
                        new A.Extents { Cx = width, Cy = height }),
                    new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle })))
            { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" });
}
