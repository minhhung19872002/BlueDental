using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.EInvoicing;

/// <summary>
/// What the cashier reads when EasyInvoice turns an invoice down, and which
/// box of the "Hóa đơn" dialog it is about.
///
/// The provider names the offending XML element in brackets — "định dạng Mã
/// số thuế người mua (CusTaxCode) không hợp lệ" — so that element picks the
/// dialog field (<c>Field</c>, an <c>IssueElectronicInvoiceDto</c> property
/// name, camel-cased), and the bracket and the generic "Dữ liệu không hợp lệ,"
/// lead are dropped from the text.
/// </summary>
public static partial class EasyInvoiceRefusal
{
    public const string FieldKey = "Field";
    public const string MessageKey = "Message";

    /// <summary>XML element (EasyInvoiceXmlBuilder) → the dialog field that fills it.</summary>
    private static readonly IReadOnlyDictionary<string, string> FieldsByElement =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["CusTaxCode"] = "taxCode",
            ["CusPhone"] = "phone",
            ["CusAddress"] = "address",
            ["CusName"] = "companyName",
            ["Buyer"] = "buyerName",
        };

    public static BusinessException From(int? errorCode, string? error)
    {
        var exception = new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ProviderRefused)
            .WithData(MessageKey, Readable(error));
        var field = FieldOf(error);
        return field == null ? exception : exception.WithData(FieldKey, field);
    }

    /// <summary>The dialog field the provider's text points at, or null.</summary>
    public static string? FieldOf(string? error)
    {
        if (string.IsNullOrEmpty(error))
        {
            return null;
        }

        return ElementPattern().Matches(error)
            .Select(m => FieldsByElement.TryGetValue(m.Groups[1].Value, out var field) ? field : null)
            .FirstOrDefault(field => field != null);
    }

    /// <summary>The provider's text without its element names and generic lead.</summary>
    public static string Readable(string? error)
    {
        if (string.IsNullOrWhiteSpace(error))
        {
            return "no response";
        }

        var text = ElementPattern().Replace(error, string.Empty);
        text = GenericLead().Replace(text, string.Empty);
        text = Spaces().Replace(text, " ").Trim();
        return text.Length == 0 ? error.Trim() : char.ToUpperInvariant(text[0]) + text[1..];
    }

    /// <summary>A bracketed PascalCase name — an XML element, not Vietnamese prose.</summary>
    [GeneratedRegex(@"\s*\(([A-Z][A-Za-z]+)\)")]
    private static partial Regex ElementPattern();

    [GeneratedRegex(@"^\s*Dữ liệu không hợp lệ\s*[,:]\s*", RegexOptions.IgnoreCase)]
    private static partial Regex GenericLead();

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Spaces();
}
