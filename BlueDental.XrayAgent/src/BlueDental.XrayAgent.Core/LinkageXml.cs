using System.Globalization;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;

namespace BlueDental.XrayAgent.Core;

/// <summary>Mirrors BlueDental's <c>Gender</c> enum (numbers on the wire).</summary>
public enum PatientGender
{
    Unknown = 0,
    Male = 1,
    Female = 2,
    Other = 3,
    PreferNotToSay = 4,
}

/// <summary>What the station's <c>patients/by-code</c> gives the bridge — no more than the linkage file needs.</summary>
public sealed record StationPatient(
    string PatientCode,
    string? LastName,
    string? FirstName,
    DateOnly? DateOfBirth,
    PatientGender Gender);

/// <summary>
/// Fills the file EzDent-i's loader reads to open (or create) a patient.
/// UNVERIFIED: the element names follow what third-party bridges document for
/// EzDent-i (ChartNumber, LastName, FirstName, Birthday, Gender); the exact
/// shape must be confirmed on the clinic's install, so a clinic can point
/// <see cref="AgentSettings.LinkageTemplatePath"/> at its own template.
/// Placeholders: {ChartNumber} {LastName} {FirstName} {FullName} {Birthday}
/// (yyyyMMdd) {BirthdayIso} (yyyy-MM-dd) {Gender} (M / F / empty).
/// </summary>
public static partial class LinkageXml
{
    public const string DefaultTemplate = """
        <?xml version="1.0" encoding="utf-8"?>
        <LinkageParameter>
          <Patient>
            <ChartNumber>{ChartNumber}</ChartNumber>
            <LastName>{LastName}</LastName>
            <FirstName>{FirstName}</FirstName>
            <Birthday>{Birthday}</Birthday>
            <Gender>{Gender}</Gender>
          </Patient>
        </LinkageParameter>
        """;

    [GeneratedRegex(@"\{([A-Za-z]+)\}", RegexOptions.CultureInvariant)]
    private static partial Regex Placeholder();

    public static string Render(string template, StationPatient patient, bool unaccent)
    {
        string Text(string? value)
        {
            var text = (value ?? string.Empty).Trim();
            if (unaccent)
                text = VietnameseText.Unaccent(text);
            return SecurityElement.Escape(text) ?? string.Empty;
        }

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ChartNumber"] = Text(patient.PatientCode),
            ["LastName"] = Text(patient.LastName),
            ["FirstName"] = Text(patient.FirstName),
            ["FullName"] = Text(string.Join(' ', new[] { patient.LastName, patient.FirstName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()))),
            ["Birthday"] = patient.DateOfBirth?.ToString("yyyyMMdd", CultureInfo.InvariantCulture) ?? string.Empty,
            ["BirthdayIso"] = patient.DateOfBirth?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
            ["Gender"] = patient.Gender switch
            {
                PatientGender.Male => "M",
                PatientGender.Female => "F",
                _ => string.Empty,
            },
        };

        // One pass, so a value holding "{…}" is never expanded again.
        return Placeholder().Replace(template, m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }
}

public static class VietnameseText
{
    /// <summary>"Nguyễn Đức" → "Nguyen Duc".</summary>
    public static string Unaccent(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            builder.Append(c switch
            {
                'đ' => 'd',
                'Đ' => 'D',
                _ => c,
            });
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
