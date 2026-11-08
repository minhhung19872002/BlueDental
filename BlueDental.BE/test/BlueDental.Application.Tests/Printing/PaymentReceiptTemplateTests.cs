using System;
using System.Buffers.Binary;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using BlueDental.Billing;
using BlueDental.Printing;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Shouldly;
using Volo.Abp.DependencyInjection;
using Xunit;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;

namespace BlueDental.Application.Tests.Printing;

/// <summary>
/// The shipped PHIẾU THU template against the values the server fills in:
/// no braces may be left on the paper, however Word split the placeholders.
/// </summary>
public class PaymentReceiptTemplateTests
{
    private static readonly PaymentReceiptContent Sample = new(
        CustomerName: "Khách <Thử> & Co",
        TreatmentWork: "Cạo vôi răng, Trám răng",
        PaidAmount: 15_000_000m,
        SlipTotal: 20_500_000m,
        PayerName: "Bệnh nhân Thử",
        IssueDate: new DateOnly(2026, 10, 7),
        CashierName: "Thu Ngân Thử");

    [Fact]
    public void Every_Placeholder_In_The_Shipped_Template_Is_Filled()
    {
        var filled = DocxTemplate.Fill(File.ReadAllBytes(TemplatePath()), Sample.ToPlaceholders());

        var xml = DocumentXml(filled);
        xml.ShouldNotContain("{{");
        xml.ShouldContain("Khách &lt;Thử&gt; &amp; Co");
        xml.ShouldContain("Cạo vôi răng, Trám răng");
        xml.ShouldContain("15.000.000 đ");
        xml.ShouldContain("Mười lăm triệu đồng");
        xml.ShouldContain("5.500.000 đ");
        xml.ShouldContain("07/10/2026");
        xml.ShouldContain("Thu Ngân Thử");
        xml.ShouldContain("Bệnh nhân Thử");
    }

    [Fact]
    public void The_Template_Holds_Exactly_The_Keys_The_Server_Fills()
    {
        // Read through the run boundaries: Word saves "{{", "Key" and "}}" as runs of their own.
        var text = Regex.Replace(DocumentXml(File.ReadAllBytes(TemplatePath())), "<[^>]+>", "");
        var keys = Regex.Matches(text, @"\{\{(\w+)\}\}").Select(m => m.Groups[1].Value).OrderBy(k => k);

        keys.ShouldBe(Sample.ToPlaceholders().Keys.OrderBy(k => k));
    }


    /// <summary>The QR takes the template's box: same centre, GrowMm larger on every side, the box itself gone.</summary>
    [Fact]
    public void The_Qr_Replaces_The_Box_Around_Its_Centre()
    {
        var template = File.ReadAllBytes(TemplatePath());
        var box = Placement(DocumentXml(template), ShapeUri);

        var xml = DocumentXml(PaymentReceiptQr.Place(template, "https://example.test/invoice-request/abc"));

        xml.ShouldNotContain(ShapeUri);
        xml.ShouldNotContain("<v:rect");
        var qr = Placement(xml, PictureUri, "invoice-request-qr");
        const long grow = (long)(PaymentReceiptQr.GrowMm * 36_000);
        qr.Size.ShouldBe(box.Size + 2 * grow);
        qr.Left.ShouldBe(box.Left - grow);
        qr.Top.ShouldBe(box.Top - grow);
        FooterXml(PaymentReceiptQr.Place(template, "https://example.test/x")).ShouldContain("QR");
    }

    [Fact]
    public void Without_A_Qr_The_Box_And_The_Scan_Hint_Go()
    {
        var docx = PaymentReceiptQr.Leave(File.ReadAllBytes(TemplatePath()));

        var xml = DocumentXml(docx);
        xml.ShouldNotContain(ShapeUri);
        xml.ShouldNotContain("<v:rect");
        xml.ShouldNotContain("invoice-request-qr");
        var footer = FooterXml(docx);
        footer.ShouldNotContain("QR");
        footer.ShouldContain("Lưu ý");
    }

    [Fact]
    public void Remaining_Is_The_Slip_Total_Less_What_Is_Paid_And_Never_Negative()
    {
        Sample.RemainingAmount.ShouldBe(5_500_000m);
        (Sample with { PaidAmount = 30_000_000m }).RemainingAmount.ShouldBe(0m);
    }

    [Theory]
    [InlineData(0, "0 đ")]
    [InlineData(999, "999 đ")]
    [InlineData(1_234_567.5, "1.234.568 đ")]
    public void Money_Is_Whole_Dong_With_Dot_Grouping(decimal amount, string expected) =>
        PaymentReceiptContent.Money(amount).ShouldBe(expected);

    /// <summary>The app service asks for the interface; ABP's naming convention alone would not register it.</summary>
    [Fact]
    public void Gotenberg_Is_Registered_As_The_Docx_Pdf_Converter() =>
        typeof(GotenbergPdfConverter).GetCustomAttribute<ExposeServicesAttribute>()!
            .ServiceTypes.ShouldContain(typeof(IDocxPdfConverter));

    /// <summary>
    /// The room the template leaves above each name: two blank 10 pt lines at
    /// 1.5 spacing in a TableGrid cell (no space after) — 2 × 345 twips, ≈ 12.2 mm.
    /// </summary>
    private const long SignatureRoomEmu = 2 * 345 * 635;

    /// <summary>
    /// The tallest a signature goes: the room less 31 twips (0.55 mm) on each
    /// side, so it can be lifted that far and leave equal paper above and below.
    /// </summary>
    private const long SignatureMaxEmu = SignatureRoomEmu - 2 * 31 * 635;

    /// <summary>
    /// P2610 phase 5: the customer's signature takes the two blank lines above
    /// Người nộp tiền's name, inline in that cell, scaled to fit and never
    /// stretched — so the sheet keeps its single page.
    /// </summary>
    [Fact]
    public void The_Signature_Takes_The_Blank_Lines_Above_The_Payer()
    {
        var template = File.ReadAllBytes(TemplatePath());
        var before = PayerCell(template);

        var signed = DocxPicture.PlaceAbove(
            template, "{{PayerName}}", Png(600, 200),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "customer-signature");

        var after = PayerCell(signed);
        before.Paragraphs.ShouldBe(after.Paragraphs + 1);
        after.Above.ShouldNotBeNull();
        after.Above.Name.ShouldBe("customer-signature");
        // 600 × 200 px into 50 mm × the ≈11.1 mm the room allows: the room binds, ≈33.2 × 11.1 mm.
        after.Above.Height.ShouldBe(SignatureMaxEmu);
        after.Above.Width.ShouldBe(SignatureMaxEmu * 3);
    }

    /// <summary>
    /// R-1101: a pad hands back its whole canvas with the name drawn off to one
    /// side. Only the strokes go on the paper — cropped, scaled to fit — and they
    /// sit midway between the label and the name, the cell keeping its height.
    /// </summary>
    [Fact]
    public void Only_The_Strokes_Go_On_The_Paper_Midway_Above_The_Name()
    {
        // 600 × 200 canvas, strokes at x 40..199, y 120..179: 160 × 60 px, low and to the left.
        var png = InkedPng(600, 200, left: 40, top: 120, right: 200, bottom: 180, pen: 2);

        PngInk.Bounds(png).ShouldBe(new PngInk.Area(36, 116, 204, 184));

        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{PayerName}}", png,
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "customer-signature");

        var after = PayerCell(signed);
        after.Above.ShouldNotBeNull();
        // 168 × 68 px into 50 mm × the room: the room's height binds.
        after.Above.Height.ShouldBeInRange(SignatureMaxEmu - 1, SignatureMaxEmu);
        after.Above.Width.ShouldBeInRange(SignatureMaxEmu * 168 / 68 - 1, SignatureMaxEmu * 168 / 68 + 1);
        after.Above.Crop.ShouldBe(new[] { 6_000, 58_000, 66_000, 8_000 });
        // As tall as it may go: lifted the whole 31 twips, all the spare paper under it.
        after.Above.SpaceBefore.ShouldBe(0);
        after.Above.SpaceAfter.ShouldBe(62);
    }

    /// <summary>A signature small enough to leave room sits midway, lifted 0.55 mm so the paper above and below its ink matches.</summary>
    [Fact]
    public void A_Short_Signature_Sits_Midway_In_The_Room()
    {
        // 500 × 100 px into 50 mm wide: 50 × 10 mm (360000 EMU ≈ 567 twips) of the 690-twip room.
        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{PayerName}}", Png(500, 100),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "customer-signature");

        var above = PayerCell(signed).Above!;
        above.Height.ShouldBe(10 * 36_000);
        var margin = (int)((SignatureRoomEmu / 635 - 10 * 36_000 / 635) / 2);
        above.SpaceBefore.ShouldBe(margin - 31);
        above.SpaceAfter.ShouldBe(margin + 31);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(6)]
    public void The_Stroke_Width_Is_Read_Off_The_Ink(int pen)
    {
        var strokes = PngInk.Measure(InkedPng(600, 200, 40, 40, 560, 160, pen))!.Value;

        strokes.Width.ShouldBe(pen, tolerance: 0.1);
        strokes.Bounds.ShouldBe(new PngInk.Area(36, 36, 564, 164));
    }

    /// <summary>
    /// BA 2026-11-08: a name signed small on the pad, blown up to fill the
    /// room, printed ~1 mm thick and jagged. The picture is never enlarged past
    /// a 0.5 mm stroke, even when the room would take it larger.
    /// </summary>
    [Fact]
    public void A_Signature_Is_Never_Enlarged_Past_A_Ballpoint_Stroke()
    {
        // A 10 px pen: 0.5 mm per 10 px = 1800 EMU per pixel; the room alone would allow ≈3115.
        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{CashierName}}", InkedPng(600, 200, 40, 40, 560, 160, pen: 10),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "accountant-signature");

        using var document = WordprocessingDocument.Open(new MemoryStream(signed), isEditable: false);
        var extent = document.MainDocumentPart!.Document.Body!.Descendants<DW.Inline>()
            .Single(i => i.DocProperties!.Name!.Value == "accountant-signature").Extent!;
        // Ink 520 × 120 px plus the 4 px margin each side: 528 × 128 px (the frame's corners read ~0.2 % thick).
        extent.Cx!.Value.ShouldBeInRange(528 * 1782, 528 * 1818);
        extent.Cy!.Value.ShouldBeInRange(128 * 1782, 128 * 1818);
    }

    /// <summary>A fine pen keeps filling the room: the cap only bites on thick strokes.</summary>
    [Fact]
    public void A_Fine_Stroke_Still_Fills_The_Room()
    {
        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{PayerName}}", InkedPng(600, 200, 40, 40, 560, 160, pen: 2),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "customer-signature");

        PayerCell(signed).Above!.Height.ShouldBeInRange(SignatureMaxEmu - 1, SignatureMaxEmu);
    }

    /// <summary>
    /// 2026-11-08 (owner): the cashier's blank lines carry no alignment, so the
    /// signature copied none and sat 5 mm left of "admin". It lines up like the
    /// name under it now, on both sides of the sheet.
    /// </summary>
    [Theory]
    [InlineData("{{CashierName}}", "accountant-signature")]
    [InlineData("{{PayerName}}", "customer-signature")]
    public void The_Signature_Is_Centred_Like_The_Name_Under_It(string text, string name)
    {
        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), text, InkedPng(600, 300, 20, 20, 580, 280),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, name);

        using var document = WordprocessingDocument.Open(new MemoryStream(signed), isEditable: false);
        var signature = document.MainDocumentPart!.Document.Body!.Descendants<Paragraph>()
            .Single(p => p.Descendants<DW.Inline>().Any(i => i.DocProperties!.Name!.Value == name));
        var nameLine = signature.NextSibling<Paragraph>()!;
        signature.ParagraphProperties!.Justification!.Val!.Value.ShouldBe(JustificationValues.Center);
        nameLine.ParagraphProperties!.Justification!.Val!.Value.ShouldBe(JustificationValues.Center);
    }

    /// <summary>
    /// 2026-11-08: the signature's line copied the blanks' 1.5 line spacing, so
    /// an 18 mm signature laid out ~27 mm tall and the A6 receipt spilled onto
    /// a blank second page. Its line is single-spaced now.
    /// </summary>
    [Fact]
    public void The_Signature_Line_Is_Single_Spaced_So_It_Takes_Only_Its_Own_Height()
    {
        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{CashierName}}", InkedPng(600, 300, 20, 20, 580, 280),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "accountant-signature");

        using var document = WordprocessingDocument.Open(new MemoryStream(signed), isEditable: false);
        var spacing = document.MainDocumentPart!.Document.Body!.Descendants<Paragraph>()
            .Single(p => p.Descendants<DW.Inline>().Any(i => i.DocProperties!.Name!.Value == "accountant-signature"))
            .ParagraphProperties!.SpacingBetweenLines!;
        spacing.Line!.Value.ShouldBe("240");
        spacing.LineRule!.Value.ShouldBe(LineSpacingRuleValues.Auto);
    }

    [Fact]
    public void A_Blank_Canvas_Or_A_Png_It_Cannot_Read_Is_Used_Whole()
    {
        PngInk.Bounds(InkedPng(60, 20, 0, 0, 0, 0)).ShouldBeNull();
        PngInk.Bounds(Png(600, 200)).ShouldBeNull();

        var signed = DocxPicture.PlaceAbove(
            File.ReadAllBytes(TemplatePath()), "{{PayerName}}", Png(600, 200),
            ReceiptExporter.SignatureMaxWidthMm, ReceiptExporter.SignatureMaxHeightMm, "customer-signature");

        PayerCell(signed).Above!.Crop.ShouldBeNull();
    }

    private sealed record Signature(string Name, long Width, long Height, int[]? Crop, int SpaceBefore, int SpaceAfter);

    private sealed record PayerCellView(int Paragraphs, Signature? Above);

    /// <summary>The table cell holding {{PayerName}}: how many lines it has, and the picture right above the name.</summary>
    private static PayerCellView PayerCell(byte[] docx)
    {
        using var document = WordprocessingDocument.Open(new MemoryStream(docx), isEditable: false);
        var payer = document.MainDocumentPart!.Document.Body!.Descendants<Paragraph>()
            .First(p => p.InnerText.Contains("PayerName"));
        var cell = payer.Ancestors<TableCell>().First();
        var above = payer.PreviousSibling<Paragraph>();
        var inline = above?.Descendants<DW.Inline>().FirstOrDefault();
        if (inline == null)
        {
            return new PayerCellView(cell.Elements<Paragraph>().Count(), null);
        }

        var crop = inline.Descendants<DocumentFormat.OpenXml.Drawing.SourceRectangle>().FirstOrDefault();
        var spacing = above!.ParagraphProperties?.SpacingBetweenLines;
        var signature = new Signature(
            inline.DocProperties!.Name!.Value!, inline.Extent!.Cx!.Value, inline.Extent.Cy!.Value,
            crop == null ? null : new[] { crop.Left!.Value, crop.Top!.Value, crop.Right!.Value, crop.Bottom!.Value },
            int.Parse(spacing?.Before?.Value ?? "0"), int.Parse(spacing?.After?.Value ?? "0"));
        return new PayerCellView(cell.Elements<Paragraph>().Count(), signature);
    }

    /// <summary>
    /// A real RGBA PNG as a canvas writes it: transparent, with a dark block
    /// where the strokes are. Each row uses the next of the five filters so the
    /// reader has to undo all of them.
    /// </summary>
    /// <summary>
    /// A canvas inked over left..right × top..bottom: solid, or only a frame
    /// <paramref name="pen"/> pixels thick round that area, as a pen draws.
    /// </summary>
    private static byte[] InkedPng(int width, int height, int left, int top, int right, int bottom, int? pen = null)
    {
        var stride = width * 4;
        var pixels = new byte[height * stride];
        for (var y = top; y < bottom; y++)
        {
            for (var x = left; x < right; x++)
            {
                var inFrame = pen is not { } p
                    || x < left + p || x >= right - p || y < top + p || y >= bottom - p;
                pixels[y * stride + x * 4 + 3] = inFrame ? (byte)255 : (byte)0;
            }
        }

        // Light noise in the background: transparent, so not ink, but it keeps the filters busy.
        for (var i = 0; i < pixels.Length; i += 4)
        {
            if (pixels[i + 3] == 0)
            {
                pixels[i] = pixels[i + 1] = pixels[i + 2] = (byte)(i * 7 % 251);
            }
        }

        var raw = new MemoryStream();
        for (var y = 0; y < height; y++)
        {
            var filter = y % 5;
            raw.WriteByte((byte)filter);
            for (var x = 0; x < stride; x++)
            {
                int a = x >= 4 ? pixels[y * stride + x - 4] : 0;
                int b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
                int c = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
                var predicted = filter switch
                {
                    1 => a,
                    2 => b,
                    3 => (a + b) / 2,
                    4 => Paeth(a, b, c),
                    _ => 0
                };
                raw.WriteByte((byte)(pixels[y * stride + x] - predicted));
            }
        }

        var deflated = new MemoryStream();
        using (var zlib = new ZLibStream(deflated, CompressionLevel.Fastest, leaveOpen: true))
        {
            raw.Position = 0;
            raw.CopyTo(zlib);
        }

        var header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header, width);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
        header[8] = 8;
        header[9] = 6;

        var png = new MemoryStream();
        png.Write(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
        Chunk(png, "IHDR", header);
        Chunk(png, "IDAT", deflated.ToArray());
        Chunk(png, "IEND", []);
        return png.ToArray();
    }

    /// <summary>Length, type, data and CRC — a valid PNG, so a render of the docx shows it.</summary>
    private static void Chunk(Stream png, string type, byte[] data)
    {
        var field = new byte[4];
        BinaryPrimitives.WriteInt32BigEndian(field, data.Length);
        png.Write(field);
        byte[] typed = [.. System.Text.Encoding.ASCII.GetBytes(type), .. data];
        png.Write(typed);
        BinaryPrimitives.WriteUInt32BigEndian(field, Crc32(typed));
        png.Write(field);
    }

    private static uint Crc32(byte[] bytes)
    {
        var crc = 0xFFFF_FFFFu;
        foreach (var b in bytes)
        {
            crc ^= b;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB8_8320u : crc >> 1;
            }
        }

        return ~crc;
    }

    private static int Paeth(int a, int b, int c)
    {
        var p = a + b - c;
        int pa = Math.Abs(p - a), pb = Math.Abs(p - b), pc = Math.Abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }

    /// <summary>The 8-byte PNG signature and an IHDR chunk: all PlaceAbove reads.</summary>
    private static byte[] Png(int width, int height)
    {
        var png = new byte[33];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52 }.CopyTo(png, 0);
        BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(16), width);
        BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(20), height);
        return png;
    }

    private static int DotLeaders(string xml) => Regex.Matches(xml, "w:leader=\"dot\"").Count;

    private static string[] TabStopPositions(string xml) =>
        Regex.Matches(xml, "<w:tab w:val=\"\\w+\"[^>]*w:pos=\"(\\d+)\"").Select(m => m.Groups[1].Value).ToArray();

    private const string ShapeUri = "uri=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\"";
    private const string PictureUri = "uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"";

    private sealed record Box(long Left, long Top, long Size);

    /// <summary>Offsets and width of the one floating drawing whose graphic is <paramref name="uri"/>.</summary>
    private static Box Placement(string xml, string uri, string? name = null)
    {
        var anchor = Regex.Matches(xml, "<wp:anchor[\\s\\S]*?</wp:anchor>")
            .Select(m => m.Value)
            .Single(a => a.Contains(uri) && (name == null || a.Contains($"name=\"{name}\"")));
        long Number(string pattern) => long.Parse(Regex.Match(anchor, pattern).Groups[1].Value);
        return new Box(
            Number("<wp:positionH[^>]*><wp:posOffset>(-?\\d+)"),
            Number("<wp:positionV[^>]*><wp:posOffset>(-?\\d+)"),
            Number("<wp:extent cx=\"(\\d+)\""));
    }

    private static string DocumentXml(byte[] docx) => PartXml(docx, "word/document.xml");

    private static string FooterXml(byte[] docx)
    {
        using var zip = new ZipArchive(new MemoryStream(docx));
        return string.Concat(zip.Entries.Where(e => e.FullName.StartsWith("word/footer"))
            .Select(e => new StreamReader(e.Open()).ReadToEnd()));
    }

    private static string PartXml(byte[] docx, string part)
    {
        using var zip = new ZipArchive(new MemoryStream(docx));
        using var reader = new StreamReader(zip.GetEntry(part)!.Open());
        return reader.ReadToEnd();
    }

    /// <summary>The template the host serves, found from the test's bin folder up to the repo.</summary>
    private static string TemplatePath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "BlueDental.HttpApi.Host", "wwwroot", "templates", "PHIẾU THU.docx");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new FileNotFoundException("PHIẾU THU.docx not found above " + AppContext.BaseDirectory);
    }
}
