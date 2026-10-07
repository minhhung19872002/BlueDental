using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.Marketing;

/// <summary>
/// One spelling for a Vietnamese phone number, so the same lead typed as
/// "+84 912.345.678" and "0912345678" is recognised as one.
/// </summary>
public static partial class TicketPhone
{
    [GeneratedRegex(@"^0\d{9,10}$")]
    private static partial Regex LocalNumber();

    /// <summary>
    /// Strips spaces, dots, dashes and brackets, turns a +84 / 84 prefix into
    /// a leading 0, and refuses anything that is not then 10–11 digits from 0.
    /// </summary>
    public static string Normalize(string? raw)
    {
        var digits = new string((raw ?? string.Empty)
            .Where(c => !char.IsWhiteSpace(c) && c is not ('.' or '-' or '(' or ')'))
            .ToArray());

        if (digits.StartsWith("+84", StringComparison.Ordinal))
        {
            digits = "0" + digits[3..];
        }
        else if (digits.StartsWith("84", StringComparison.Ordinal) && digits.Length == 11)
        {
            digits = "0" + digits[2..];
        }

        if (!LocalNumber().IsMatch(digits))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidPhone);
        }

        return digits;
    }

    /// <summary>
    /// The spellings a patient record may hold the same number in. Patient
    /// phones are stored as typed (trimmed), so a lookup has to try each.
    /// </summary>
    public static IReadOnlyList<string> Variants(string normalized) =>
    [
        normalized,
        "+84" + normalized[1..],
        "84" + normalized[1..],
    ];
}
