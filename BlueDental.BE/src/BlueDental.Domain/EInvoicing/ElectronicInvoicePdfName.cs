using System;
using System.IO;
using System.Text.RegularExpressions;

namespace BlueDental.EInvoicing;

/// <summary>
/// The file name EasyInvoice gives an invoice PDF, so a download from
/// BlueDental is named as one from the portal (BA 2026-11-18). Read off the
/// sandbox's <c>Content-Disposition</c> the same day:
///
/// <code>
/// 2026_1118_1C26TYY_0_0318531468.pdf   ArisingDate 18/11
/// 2026_106_1C26TYY_0_0318531468.pdf    ArisingDate 06/10
/// 2026_929_1C26TYY_0_0318531468.pdf    no ArisingDate, sent 29/09
/// </code>
///
/// i.e. <c>{yyyy}_{M}{d}_{Pattern}{Serial}_{No}_{TaxCode}.pdf</c> — month and
/// day unpadded, <c>0</c> while the invoice has no number yet.
/// </summary>
public static partial class ElectronicInvoicePdfName
{
    private const string NotNumberedYet = "0";

    /// <summary>The provider's name for an invoice whose PDF did not come with one.</summary>
    public static string Build(string pattern, string? serial, string? no, DateOnly invoiceDate, string taxCode)
    {
        var number = string.IsNullOrWhiteSpace(no) ? NotNumberedYet : no.Trim();
        var name = $"{invoiceDate.Year}_{invoiceDate.Month}{invoiceDate.Day}_{pattern}{serial}_{number}_{taxCode}.pdf";
        return UnsafeCharacters().Replace(name, "_");
    }

    /// <summary>
    /// The name the provider sent, or null when there was none or it is not a
    /// plain <c>.pdf</c> file name — it ends up in our own response header.
    /// </summary>
    public static string? FromProvider(string? fileName)
    {
        var name = Path.GetFileName(fileName?.Trim().Trim('"') ?? string.Empty);
        return SafePdfName().IsMatch(name) ? name : null;
    }

    [GeneratedRegex("[^A-Za-z0-9._-]")]
    private static partial Regex UnsafeCharacters();

    [GeneratedRegex(@"^[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}\.pdf$", RegexOptions.IgnoreCase)]
    private static partial Regex SafePdfName();
}
