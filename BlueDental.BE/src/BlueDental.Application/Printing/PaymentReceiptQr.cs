using QRCoder;

namespace BlueDental.Printing;

/// <summary>
/// The QR on a PHIẾU THU with "Xuất hóa đơn đỏ" ticked. The template marks
/// its place with a box drawn at the QR's printed size, so what Word shows is
/// what the paper gets (owner 2026-11-07; it was 2 mm larger per side since
/// 2026-10-13). A receipt without the QR loses the box and the footer line
/// asking to scan it.
/// </summary>
public static class PaymentReceiptQr
{
    /// <summary>How much larger than the template's box, on every side: none, the box is the QR's size.</summary>
    public const double GrowMm = 0;

    /// <summary>The footer line that tells the customer to scan the QR.</summary>
    public const string ScanHint = "mã QR";

    public static byte[] Place(byte[] docx, string url) =>
        DocxPicture.ReplaceBox(docx, Png(url), GrowMm, "invoice-request-qr");

    public static byte[] Leave(byte[] docx) =>
        DocxTemplate.DropParagraphs(DocxPicture.RemoveBox(docx), ScanHint);

    /// <summary>No quiet zone of its own: the white paper around the box is one, and the code fills the box.</summary>
    public static byte[] Png(string url)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        return new PngByteQRCode(data).GetGraphic(10, drawQuietZones: false);
    }
}
