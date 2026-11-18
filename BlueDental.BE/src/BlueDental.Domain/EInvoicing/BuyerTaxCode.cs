using System.Text.RegularExpressions;

namespace BlueDental.EInvoicing;

/// <summary>Mã số thuế người mua as EasyInvoice takes it.</summary>
public static partial class BuyerTaxCode
{
    /// <summary>The tax office's weights for the first nine digits; the tenth checks them.</summary>
    private static readonly int[] CheckWeights = [31, 29, 23, 19, 17, 13, 7, 5, 3];

    /// <summary>
    /// 10 digits (company), the company's 10 + "-" + 3 (branch — EasyInvoice
    /// refuses the 13 digits without the dash), or 12 (căn cước công dân). A
    /// company or branch code must carry a right check digit, as every code the
    /// tax office issues does; a CCCD has none.
    /// </summary>
    public static bool IsValid(string taxCode)
    {
        var value = taxCode.Trim();
        if (!Pattern().IsMatch(value)) return false;
        return value.Length == 12 || HasValidCheckDigit(value);
    }

    private static bool HasValidCheckDigit(string digits)
    {
        var sum = 0;
        for (var i = 0; i < CheckWeights.Length; i++) sum += CheckWeights[i] * (digits[i] - '0');
        return 10 - sum % 11 == digits[9] - '0';
    }

    [GeneratedRegex(@"^(\d{10}(-\d{3})?|\d{12})$")]
    private static partial Regex Pattern();
}
