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

    /// <summary>The most digits a Vietnamese number has once its 0 is dropped (02x landlines).</summary>
    private const int NationalWithoutZeroMaxLength = 10;

    /// <summary>
    /// Drops spaces and the separators people type (<c>. - ( )</c>), reads a
    /// leading <c>00</c> as <c>+</c>, and folds a Vietnamese international
    /// number back to its national form. Digits alone are a Vietnamese number
    /// by the rule above, so the same phone typed beside the +84 flag without
    /// its 0 (<c>901234567</c>), or with the code but no <c>+</c>
    /// (<c>84901234567</c>, how Zalo writes it), gets its 0 back. Anything
    /// else is left as typed for <see cref="IsValid"/> to judge.
    /// </summary>
    public static string? Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return phone?.Trim();

        var value = Separators().Replace(phone, "");
        if (value.StartsWith("00")) value = "+" + value[2..];

        if (value.StartsWith("+" + VietnamCallingCode))
            return "0" + value[(1 + VietnamCallingCode.Length)..].TrimStart('0');

        if (!WithoutZero().IsMatch(value)) return value;
        if (value.Length <= NationalWithoutZeroMaxLength) return "0" + value;
        return value.StartsWith(VietnamCallingCode)
            ? "0" + value[VietnamCallingCode.Length..].TrimStart('0')
            : value;
    }

    /// <summary>
    /// <paramref name="phone"/> normalized, and the spellings that number may
    /// have been saved under before <see cref="Normalize"/> gave the 0 back. A
    /// lookup by number matches them all, so an older hồ sơ is still found.
    /// </summary>
    public static string[] Spellings(string phone)
    {
        var normalized = Normalize(phone) ?? "";
        if (!NationalWithZero().IsMatch(normalized)) return [normalized];

        var bare = normalized[1..];
        return [normalized, bare, VietnamCallingCode + bare, "+" + VietnamCallingCode + bare];
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

    /// <summary>A Vietnamese number short of its 0, or with 84 in front of it.</summary>
    [GeneratedRegex(@"^[1-9]\d{8,11}$")]
    private static partial Regex WithoutZero();

    [GeneratedRegex(@"^0[1-9]\d{8,9}$")]
    private static partial Regex NationalWithZero();
}
