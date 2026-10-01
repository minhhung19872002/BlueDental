using System;
using System.Linq;
using Volo.Abp;

namespace BlueDental.Zalo;

/// <summary>
/// ZNS wants the international form without a plus: <c>84xxxxxxxxx</c>.
/// Clinics store numbers as people say them (<c>0903…</c>), so this is the
/// one place that turns them around.
/// </summary>
public static class ZaloPhoneNumber
{
    public static string Normalize(string? raw)
    {
        var digits = new string((raw ?? string.Empty).Where(char.IsDigit).ToArray());

        if (digits.StartsWith("840", StringComparison.Ordinal) && digits.Length == 12)
        {
            digits = "84" + digits[3..];
        }
        else if (digits.StartsWith('0') && digits.Length == 10)
        {
            digits = "84" + digits[1..];
        }

        if (!(digits.StartsWith("84", StringComparison.Ordinal) && digits.Length == 11))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Tools.ZaloInvalidPhone,
                "A Zalo message needs a Vietnamese mobile number.");
        }

        return digits;
    }

    /// <summary>The <c>0xxxxxxxxx</c> form people read, for a phone shown inside a message.</summary>
    public static string ToLocal(string normalized) =>
        normalized.StartsWith("84", StringComparison.Ordinal) ? "0" + normalized[2..] : normalized;
}
