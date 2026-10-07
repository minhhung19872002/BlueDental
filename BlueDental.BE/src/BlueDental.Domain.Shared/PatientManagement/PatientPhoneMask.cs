using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>
/// Cụm 11 mục 9 — "Ẩn số điện thoại": how a patient (or guardian) phone is
/// shown to an account holding <c>patient.hidePhone</c>, and how such a shown
/// value is told apart from a real number when it comes back in an edit.
///
/// The first three and last three characters stay, the rest become '*':
/// <c>0901234567</c> → <c>090****567</c>. A number of six characters or fewer
/// keeps only its last two.
/// </summary>
public static partial class PatientPhoneMask
{
    public const char MaskChar = '*';

    public static string? Mask(string? phone)
    {
        if (string.IsNullOrEmpty(phone) || IsMasked(phone)) return phone;

        var value = phone.Trim();
        if (value.Length <= 6)
            return new string(MaskChar, System.Math.Max(0, value.Length - 2)) + value[^System.Math.Min(2, value.Length)..];

        return value[..3] + new string(MaskChar, value.Length - 6) + value[^3..];
    }

    public static bool IsMasked(string? value) => value?.Contains(MaskChar) == true;

    /// <summary>
    /// Masks every phone-looking run of digits inside free text (a message log
    /// that quotes the number it was sent to).
    /// </summary>
    public static string? MaskEmbedded(string? text) =>
        string.IsNullOrEmpty(text) ? text : PhoneRun().Replace(text, m => Mask(m.Value)!);

    /// <summary>
    /// The number an edit means. A value without '*' is what the user typed.
    /// A masked value is what the screen showed: it stands for the one known
    /// number whose mask it is — the record's own phone, a linked patient's —
    /// and is refused when none (or more than one) fits, so a masked value is
    /// never stored and never overwrites the real number.
    /// </summary>
    public static string? Resolve(string? incoming, params string?[] known)
    {
        if (!IsMasked(incoming)) return incoming;

        var matches = known
            .Where(k => !string.IsNullOrWhiteSpace(k) && Mask(k) == incoming!.Trim())
            .Select(k => k!.Trim())
            .Distinct()
            .ToList();

        return matches.Count == 1
            ? matches[0]
            : throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MaskedPhoneUnresolved);
    }

    public static string? Resolve(string? incoming, IEnumerable<string?> known) =>
        Resolve(incoming, known.ToArray());

    [GeneratedRegex(@"(?<!\d)\+?\d{8,15}(?!\d)")]
    private static partial Regex PhoneRun();
}
