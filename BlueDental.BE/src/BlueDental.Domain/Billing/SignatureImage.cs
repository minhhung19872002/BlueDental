using System;
using Volo.Abp;

namespace BlueDental.Billing;

/// <summary>
/// The customer's drawing as the iPad sends it: a PNG in a data URL. Only a
/// real PNG of sane size is taken, so nothing else is ever encrypted and
/// later printed on a PHIẾU THU.
/// </summary>
public static class SignatureImage
{
    public const string DataUrlPrefix = "data:image/png;base64,";

    /// <summary>Raw PNG bytes; a finger signature is a few dozen KB.</summary>
    public const int MaxBytes = 512 * 1024;

    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public static byte[] FromDataUrl(string? dataUrl) =>
        FromDataUrl(dataUrl, MaxBytes, BlueDentalDomainErrorCodes.Billing.SignatureInvalid);

    /// <summary>
    /// With a cap of its own and the error to give past it — the accountant's
    /// Ký điện tử image is held to less than the iPad's (P2910_02).
    /// </summary>
    public static byte[] FromDataUrl(string? dataUrl, int maxBytes, string tooLargeCode)
    {
        if (dataUrl == null || !dataUrl.StartsWith(DataUrlPrefix, StringComparison.Ordinal))
        {
            throw Invalid();
        }

        byte[] png;
        try
        {
            png = Convert.FromBase64String(dataUrl[DataUrlPrefix.Length..]);
        }
        catch (FormatException)
        {
            throw Invalid();
        }

        if (png.Length <= PngMagic.Length || !png.AsSpan(0, PngMagic.Length).SequenceEqual(PngMagic))
        {
            throw Invalid();
        }

        if (png.Length > maxBytes)
        {
            throw new BusinessException(tooLargeCode);
        }

        return png;
    }

    public static string ToDataUrl(byte[] png) => DataUrlPrefix + Convert.ToBase64String(png);

    private static BusinessException Invalid() => new(BlueDentalDomainErrorCodes.Billing.SignatureInvalid);
}
