using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>
/// How a patient, guardian or temporary-appointment phone is stored.
///
/// A Vietnamese number keeps its national form with the leading 0
/// (<c>0901234567</c>) — every existing record, the duplicate check and the
/// Zalo sender rely on it. A foreign number is stored E.164:
/// <c>+</c>, country code, then the national number without its trunk 0
/// (<c>+14155550123</c>, <c>+821012345678</c>). One spelling per number keeps
/// the exact-match duplicate check working.
/// </summary>
public static partial class PatientPhoneFormat
{
    public const string VietnamCallingCode = "84";

    /// <summary>
    /// Drops spaces and the separators people type (<c>. - ( )</c>), reads a
    /// leading <c>00</c> as <c>+</c>, and folds a Vietnamese international
    /// number back to its national form. Anything else is left as typed for
    /// <see cref="IsValid"/> to judge.
    /// </summary>
    public static string? Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return phone?.Trim();

        var value = Separators().Replace(phone, "");
        if (value.StartsWith("00")) value = "+" + value[2..];

        if (value.StartsWith("+" + VietnamCallingCode))
            return "0" + value[(1 + VietnamCallingCode.Length)..].TrimStart('0');

        return value;
    }

    public static bool IsValid(string? phone) => phone is not null && Pattern().IsMatch(phone);

    /// <summary>
    /// The phone an edit stores: normalized, and refused when it is not a
    /// phone number. <paramref name="known"/> are the numbers already on file
    /// (the record's own, a linked patient's): one saved before this rule
    /// existed is kept as it is, so an old record can still be edited without
    /// retyping its phone.
    /// </summary>
    public static string? Prepare(string? phone, params string?[] known)
    {
        var value = Normalize(phone);
        if (string.IsNullOrEmpty(value) || known.Any(k => k?.Trim() == value)) return value;

        return IsValid(value)
            ? value
            : throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.InvalidPhone);
    }

    [GeneratedRegex(@"[\s.\-()]")]
    private static partial Regex Separators();

    [GeneratedRegex(@"^(\+[1-9]\d{6,14}|\d{8,15})$")]
    private static partial Regex Pattern();
}
