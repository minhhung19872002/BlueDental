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
    private const long EmuPerTwip = 635;

    /// <summary>How tall a line of text lays out at single spacing, as a share of its font size.</summary>
    private const double SingleLineFactor = 1.15;

    /// <summary>Single spacing, in 240ths of a line: the signature's line is exactly the picture's height.</summary>
    private const string SingleSpacing = "240";

    /// <summary>
    /// How far above the middle of the room the picture goes, in twips. The
    /// label's 1.5-spaced line leaves ~2.2 mm of paper under its letters but
    /// the name only ~1.1 mm over its own, so a picture centred in the room
    /// looks 0.55 mm low. Lifting it this far, and keeping it that much shorter
    /// than the room on each side, gives equal gaps of paper above and below.
    /// Measured on PHIẾU THU rendered by Gotenberg (2026-11-08); it was a 0.5 mm
    /// push down, measured on the earlier template.
    /// </summary>
    private const long InkLiftTwips = 31;

    /// <summary>
    /// The thickest a signature's stroke may print, in mm: about a ballpoint's
    /// line. A pad draws a few-pixel pen, so a name signed small and blown up
    /// to fill the room printed ~1 mm thick and jagged (BA 2026-11-08). The
    /// picture is never enlarged past this; a small signature stays small.
    /// </summary>
    private const double MaxStrokeMm = 0.5;
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
    /// Only the strokes are used: the empty canvas round them is cropped off and
    /// they sit midway in that room, right above the name (R-1101). The room is
    /// measured from the blank lines as the template sets them (font size, line
    /// spacing, space before/after), the picture is never taller than it, and
    /// its line is single-spaced. It used to copy the blanks' 1.5 spacing and
    /// assume 12 pt lines, so an 18 mm signature took ~27 mm of a ~12 mm room
    /// and pushed the A6 PHIẾU THU onto a second page (2026-11-08).
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

            var size = PngSize(png);
            var strokes = PngInk.Measure(png);
            var ink = strokes?.Bounds ?? new PngInk.Area(0, 0, (int)size.Width, (int)size.Height);
            var room = RoomTwips(main, blanks);
            var lift = room > 2 * InkLiftTwips ? InkLiftTwips : 0;
            var maxHeight = room > 0 ? Math.Min(Emu(maxHeightMm), (room - 2 * lift) * EmuPerTwip) : Emu(maxHeightMm);
            var maxEmuPerPixel = strokes is { } s ? Emu(MaxStrokeMm) / s.Width : double.MaxValue;
            var (width, height) = Fit((ink.Width, ink.Height), Emu(maxWidthMm), maxHeight, maxEmuPerPixel);
            var properties = blanks.LastOrDefault()?.ParagraphProperties?.CloneNode(true) as ParagraphProperties
                ?? new ParagraphProperties();
            // Lined up like the name under it: the cashier's blanks carry no
            // alignment, so a copy of theirs left the signature 5 mm off centre.
            properties.Justification = target.ParagraphProperties?.Justification?.CloneNode(true) as Justification
                ?? new Justification { Val = JustificationValues.Center };
            var margin = Math.Max(0, (room - height / EmuPerTwip) / 2);
            var shift = Math.Min(margin, lift);
            properties.SpacingBetweenLines = new SpacingBetweenLines
            {
                Before = (margin - shift).ToString(),
                After = (margin + shift).ToString(),
                Line = SingleSpacing,
                LineRule = LineSpacingRuleValues.Auto
            };
            target.InsertBeforeSelf(new Paragraph(
                properties,
                new Run(Inline(AddImage(main, png), NextPictureId(main), name, width, height, Crop(ink, size)))));
            blanks.ForEach(p => p.Remove());
        });

    /// <summary>
    /// How tall the blank lines lay out, in twips: each one's line (its font
    /// size × 1.15, times its line spacing) plus its space before and after,
    /// falling back on the document's defaults for whatever it leaves unset.
    /// </summary>
    private static long RoomTwips(MainDocumentPart main, IEnumerable<Paragraph> blanks) =>
        blanks.Sum(blank => LineTwips(blank, main.StyleDefinitionsPart?.Styles));

    /// <summary>
    /// One blank line's height. Each setting comes from the first place that
    /// has it, as Word resolves it: the paragraph, its paragraph style, the
    /// table style of the table it sits in (PHIẾU THU's TableGrid zeroes the
    /// space after), then the document defaults.
    /// </summary>
    private static long LineTwips(Paragraph blank, Styles? styles)
    {
        var defaults = styles?.DocDefaults;
        var paragraphStyle = Style(styles, blank.ParagraphProperties?.ParagraphStyleId?.Val?.Value);
        var tableStyle = Style(styles, blank.Ancestors<Table>().FirstOrDefault()
            ?.GetFirstChild<TableProperties>()?.TableStyle?.Val?.Value);
        var spacings = new[]
        {
            blank.ParagraphProperties?.SpacingBetweenLines,
            paragraphStyle?.StyleParagraphProperties?.SpacingBetweenLines,
            tableStyle?.StyleParagraphProperties?.SpacingBetweenLines,
            defaults?.ParagraphPropertiesDefault?.ParagraphPropertiesBaseStyle?.SpacingBetweenLines
        }.OfType<SpacingBetweenLines>().ToList();
        string? First(Func<SpacingBetweenLines, string?> read) => spacings.Select(read).FirstOrDefault(v => v != null);

        var halfPoints = Number(
            blank.ParagraphProperties?.ParagraphMarkRunProperties?.GetFirstChild<FontSize>()?.Val?.Value
            ?? paragraphStyle?.StyleRunProperties?.FontSize?.Val?.Value
            ?? tableStyle?.StyleRunProperties?.FontSize?.Val?.Value
            ?? defaults?.RunPropertiesDefault?.RunPropertiesBaseStyle?.FontSize?.Val?.Value, 24);
        var natural = halfPoints * 10 * SingleLineFactor;
        var line = Number(First(s => s.Line?.Value), 240);
        var rule = spacings.Select(s => s.LineRule?.Value).FirstOrDefault(v => v != null) ?? LineSpacingRuleValues.Auto;
        var height = rule == LineSpacingRuleValues.Exact ? line
            : rule == LineSpacingRuleValues.AtLeast ? Math.Max(natural, line)
            : natural * line / 240;
        return (long)Math.Round(height + Number(First(s => s.Before?.Value), 0) + Number(First(s => s.After?.Value), 0));
    }

    private static Style? Style(Styles? styles, string? id) =>
        id == null ? null : styles?.Elements<Style>().FirstOrDefault(s => s.StyleId?.Value == id);

    private static double Number(string? value, double fallback) =>
        double.TryParse(value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : fallback;

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

    /// <summary>What is cut off each side, in thousandths of a percent of the picture; null when nothing is.</summary>
    private static A.SourceRectangle? Crop(PngInk.Area ink, (long Width, long Height) size)
    {
        if (ink.Width == size.Width && ink.Height == size.Height)
        {
            return null;
        }

        static int Share(long pixels, long of) => (int)(pixels * 100_000 / of);
        return new A.SourceRectangle
        {
            Left = Share(ink.Left, size.Width),
            Top = Share(ink.Top, size.Height),
            Right = Share(size.Width - ink.Right, size.Width),
            Bottom = Share(size.Height - ink.Bottom, size.Height)
        };
    }

    private static (long Width, long Height) Fit(
        (long Width, long Height) pixels, long maxWidth, long maxHeight, double maxEmuPerPixel = double.MaxValue)
    {
        var scale = Math.Min(maxEmuPerPixel, Math.Min(
            (double)maxWidth / Math.Max(1, pixels.Width),
            (double)maxHeight / Math.Max(1, pixels.Height)));
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

    private static Drawing Inline(
        string relationshipId, uint id, string name, long width, long height, A.SourceRectangle? crop) =>
        new(new DW.Inline(
            new DW.Extent { Cx = width, Cy = height },
            new DW.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
            new DW.DocProperties { Id = id, Name = name },
            new DW.NonVisualGraphicFrameDrawingProperties(new A.GraphicFrameLocks { NoChangeAspect = true }),
            Graphic(relationshipId, name, width, height, crop))
        {
            DistanceFromTop = 0,
            DistanceFromBottom = 0,
            DistanceFromLeft = 0,
            DistanceFromRight = 0
        });

    /// <summary><paramref name="crop"/> goes between the blip and the stretch, as the schema orders them.</summary>
    private static A.Graphic Graphic(
        string relationshipId, string name, long width, long height, A.SourceRectangle? crop = null) =>
        new(new A.GraphicData(
            new PIC.Picture(
                new PIC.NonVisualPictureProperties(
                    new PIC.NonVisualDrawingProperties { Id = 0, Name = name + ".png" },
                    new PIC.NonVisualPictureDrawingProperties()),
                new PIC.BlipFill(new OpenXmlElement?[]
                    {
                        new A.Blip { Embed = relationshipId },
                        crop,
                        new A.Stretch(new A.FillRectangle())
                    }.OfType<OpenXmlElement>()),
                new PIC.ShapeProperties(
                    new A.Transform2D(
                        new A.Offset { X = 0, Y = 0 },
                        new A.Extents { Cx = width, Cy = height }),
                    new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle })))
            { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" });
}
