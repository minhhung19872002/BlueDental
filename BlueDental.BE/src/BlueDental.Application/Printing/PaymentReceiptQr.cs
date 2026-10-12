using QRCoder;

namespace BlueDental.Printing;

/// <summary>
/// The QR on a PHIẾU THU with "Xuất hóa đơn đỏ" ticked. Where it sits on the
/// A5 landscape page (210 × 148 mm) is a placeholder until the BA sends the
/// design (UNKNOWN_REFERENCE_BEHAVIOR).
/// </summary>
public static class PaymentReceiptQr
{
    public const double SizeMm = 20;
    public const double LeftMm = 182;
    public const double TopMm = 120;

    public static byte[] Png(string url)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        return new PngByteQRCode(data).GetGraphic(10);
    }
}
