using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Volo.Abp;

namespace BlueDental.Labo;

/// <summary>
/// Thông tin bổ sung of a Phiếu yêu cầu (F-93): a copy of the Mẫu phiếu's
/// fields as they were when the order picked it, with the answers. The order
/// reads back from this copy alone, so a later edit or delete of the template
/// leaves it as written.
/// </summary>
public class LaboExtraForm
{
    public Guid TemplateId { get; private set; }
    public string TemplateName { get; private set; } = default!;
    public int Version { get; private set; }
    public List<LaboExtraFormEntry> Entries { get; private set; } = [];

    protected LaboExtraForm() { }

    /// <summary>A template just picked: its current fields, answered.</summary>
    public static LaboExtraForm From(
        LaboFormTemplate template, IReadOnlyDictionary<string, IReadOnlyList<string>> answers)
    {
        return new LaboExtraForm
        {
            TemplateId = template.Id,
            TemplateName = template.Name,
            Version = template.Version,
            Entries = template.Fields
                .Select(f => LaboExtraFormEntry.Create(f.Key, f.Label, f.Type, f.Required, f.Options, answers))
                .ToList(),
        };
    }

    /// <summary>The same template saved again: the copied fields stay, only the answers change.</summary>
    public LaboExtraForm WithAnswers(IReadOnlyDictionary<string, IReadOnlyList<string>> answers)
    {
        return new LaboExtraForm
        {
            TemplateId = TemplateId,
            TemplateName = TemplateName,
            Version = Version,
            Entries = Entries
                .Select(e => LaboExtraFormEntry.Create(e.Key, e.Label, e.Type, e.Required, e.Options, answers))
                .ToList(),
        };
    }

    /// <summary>The first required field left blank, for Tạo phiếu Labo.</summary>
    public LaboExtraFormEntry? FirstMissing() => Entries.FirstOrDefault(e => e.Required && e.Values.Count == 0);
}

/// <summary>One copied field of <see cref="LaboExtraForm"/> and its answer (none, one, or several for MultiSelect).</summary>
public class LaboExtraFormEntry
{
    public const int MaxTextLength = 500;
    public const int MaxLongTextLength = 4000;

    public string Key { get; private set; } = default!;
    public string Label { get; private set; } = default!;
    public LaboFormFieldType Type { get; private set; }
    public bool Required { get; private set; }
    public List<string> Options { get; private set; } = [];
    public List<string> Values { get; private set; } = [];

    protected LaboExtraFormEntry() { }

    internal static LaboExtraFormEntry Create(
        string key, string label, LaboFormFieldType type, bool required, IReadOnlyList<string> options,
        IReadOnlyDictionary<string, IReadOnlyList<string>> answers)
    {
        var given = answers.TryGetValue(key, out var raw) ? raw : [];
        return new LaboExtraFormEntry
        {
            Key = key,
            Label = label,
            Type = type,
            Required = required,
            Options = options.ToList(),
            Values = Clean(label, type, options, given),
        };
    }

    /// <summary>
    /// Blank answers count as none. Anything else must fit the field's kind,
    /// or the save is refused (Labo:0049) rather than storing a wrong value.
    /// </summary>
    private static List<string> Clean(
        string label, LaboFormFieldType type, IReadOnlyList<string> options, IReadOnlyList<string> given)
    {
        // A form post sends line breaks as CRLF; they are kept as "\n" so a long text counts as typed.
        var values = given
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v.Replace("\r\n", "\n").Replace('\r', '\n').Trim())
            .ToList();
        if (values.Count == 0)
            return [];

        if (type == LaboFormFieldType.MultiSelect)
        {
            var picked = values.ToHashSet(StringComparer.Ordinal);
            if (!picked.All(options.Contains))
                throw Invalid(label);
            return options.Where(picked.Contains).ToList();
        }

        if (values.Count > 1)
            throw Invalid(label);
        return [CleanOne(type, options, values[0]) ?? throw Invalid(label)];
    }

    private static string? CleanOne(LaboFormFieldType type, IReadOnlyList<string> options, string value) => type switch
    {
        LaboFormFieldType.Text => value.Length <= MaxTextLength ? value : null,
        LaboFormFieldType.LongText => value.Length <= MaxLongTextLength ? value : null,
        LaboFormFieldType.Number => decimal.TryParse(
            value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture, out var number)
            ? number.ToString(CultureInfo.InvariantCulture)
            : null,
        LaboFormFieldType.Date => DateOnly.TryParseExact(
            value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : null,
        LaboFormFieldType.Select => options.Contains(value) ? value : null,
        LaboFormFieldType.YesNo => bool.TryParse(value, out var yes) ? (yes ? "true" : "false") : null,
        _ => null,
    };

    private static BusinessException Invalid(string label) =>
        new BusinessException(BlueDentalDomainErrorCodes.Labo.ExtraAnswerInvalid).WithData("field", label);
}
