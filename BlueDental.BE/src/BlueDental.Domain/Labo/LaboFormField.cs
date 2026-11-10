using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.Labo;

/// <summary>
/// One field of a Mẫu phiếu bổ sung (F-93), kept in the template's JSON.
/// <see cref="Key"/> stays the same across edits, so an answer can be matched
/// to its field even after the label changes.
/// </summary>
public class LaboFormField
{
    public const int MaxLabelLength = 200;
    public const int MaxKeyLength = 40;
    public const int MaxOptions = 50;
    public const int MaxOptionLength = 100;

    private static readonly Regex KeyShape = new("^[A-Za-z0-9_-]+$", RegexOptions.Compiled);

    public string Key { get; private set; } = default!;
    public string Label { get; private set; } = default!;
    public LaboFormFieldType Type { get; private set; }
    public bool Required { get; private set; }

    /// <summary>The choices of a Select / MultiSelect field; empty for every other kind.</summary>
    public List<string> Options { get; private set; } = [];

    protected LaboFormField() { }

    /// <summary>
    /// A field as the builder sends it. A missing or malformed key gets a new
    /// one; options are trimmed, blanks dropped, and only kept on choice fields.
    /// A blank label is let through here so the template can name its position.
    /// </summary>
    public static LaboFormField Create(
        string? key, string? label, LaboFormFieldType type, bool required, IEnumerable<string?>? options)
    {
        var trimmed = label?.Trim() ?? string.Empty;
        if (!Enum.IsDefined(type))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormFieldTypeInvalid)
                .WithData("field", trimmed);
        }

        return new LaboFormField
        {
            Key = IsValidKey(key) ? key!.Trim() : NewKey(),
            Label = trimmed,
            Type = type,
            Required = required,
            Options = IsChoice(type) && trimmed.Length > 0 ? CleanOptions(trimmed, options) : [],
        };
    }

    public static bool IsChoice(LaboFormFieldType type) =>
        type is LaboFormFieldType.Select or LaboFormFieldType.MultiSelect;

    public static bool IsValidKey(string? key) =>
        !string.IsNullOrWhiteSpace(key) && key.Trim().Length <= MaxKeyLength && KeyShape.IsMatch(key.Trim());

    /// <summary>Gives the field a new key — used when two fields of one template arrive with the same one.</summary>
    internal string TakeNewKey()
    {
        Key = NewKey();
        return Key;
    }

    private static string NewKey() => Guid.NewGuid().ToString("N");

    private static List<string> CleanOptions(string label, IEnumerable<string?>? options)
    {
        var cleaned = (options ?? [])
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o!.Trim())
            .ToList();
        var repeated = cleaned.Count != cleaned.Distinct(StringComparer.OrdinalIgnoreCase).Count();
        if (cleaned.Count == 0 || cleaned.Count > MaxOptions || repeated
            || cleaned.Any(o => o.Length > MaxOptionLength))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormFieldOptionsInvalid)
                .WithData("field", label);
        }

        return cleaned;
    }
}
