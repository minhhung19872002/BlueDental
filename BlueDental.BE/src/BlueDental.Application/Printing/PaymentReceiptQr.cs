using QRCoder;

namespace BlueDental.Printing;

/// <summary>
/// The QR on a PHIẾU THU with "Xuất hóa đơn đỏ" ticked. The template marks
/// its place with a box; the QR takes the box's centre, a little larger than
/// the box (owner 2026-10-13). A receipt without the QR loses the box and the
/// footer line asking to scan it.
/// </summary>
public static class PaymentReceiptQr
{
    /// <summary>How much larger than the template's box, on every side.</summary>
    public const double GrowMm = 2;

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
