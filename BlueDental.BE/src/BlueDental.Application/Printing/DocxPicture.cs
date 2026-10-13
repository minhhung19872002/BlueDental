using System;
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
/// A picture whose place is drawn in the template: the one floating shape on
/// the page (a box) marks where it goes, so moving it is a Word edit, not a
/// code change. The picture keeps the box's anchor and centre and floats in
/// front of the text, so the template's own layout does not move.
/// </summary>
public static class DocxPicture
{
    private const long EmuPerMillimetre = 36_000;
    private const string ShapeUri = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";

    /// <summary>Swaps the box for a square PNG, <paramref name="growMm"/> larger on every side around the box's centre.</summary>
    public static byte[] ReplaceBox(byte[] docx, byte[] png, double growMm, string name) =>
        Edit(docx, (main, box) =>
        {
            var imagePart = main.AddImagePart(ImagePartType.Png);
            using (var image = new MemoryStream(png))
            {
                imagePart.FeedData(image);
            }

            var anchor = box.Descendants<DW.Anchor>().First();
            var extent = anchor.Extent ?? throw new InvalidDataException("The box has no size.");
            var size = Math.Max(extent.Cx!.Value, extent.Cy!.Value) + 2 * Emu(growMm);
            var horizontal = (DW.HorizontalPosition)anchor.HorizontalPosition!.CloneNode(true);
            var vertical = (DW.VerticalPosition)anchor.VerticalPosition!.CloneNode(true);
            Shift(horizontal.PositionOffset, (extent.Cx.Value - size) / 2);
            Shift(vertical.PositionOffset, (extent.Cy.Value - size) / 2);

            var pictureId = (uint)(main.Document.Descendants<DW.DocProperties>().Count() + 1000);
            box.InsertAfterSelf(Anchored(main.GetIdOfPart(imagePart), pictureId, name, horizontal, vertical, size));
            box.Remove();
        });

    /// <summary>Drops the box: nothing goes in its place on this copy.</summary>
    public static byte[] RemoveBox(byte[] docx) => Edit(docx, (_, box) => box.Remove());

    private static byte[] Edit(byte[] docx, Action<MainDocumentPart, OpenXmlElement> edit)
    {
        using var stream = new MemoryStream();
        stream.Write(docx);

        using (var document = WordprocessingDocument.Open(stream, isEditable: true))
        {
            var main = document.MainDocumentPart
                ?? throw new InvalidDataException("The document has no body.");
            edit(main, Box(main.Document.Body ?? throw new InvalidDataException("The document has no body.")));
        }

        return stream.ToArray();
    }

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
            new A.Graphic(new A.GraphicData(
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
                            new A.Extents { Cx = size, Cy = size }),
                        new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle })))
                { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" }))
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
}
