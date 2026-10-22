using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace BlueDental.Tools;

/// <summary>
/// Puts a customer's values into a template's <c>{variables}</c>. A variable
/// with no value takes its fallback when <see cref="MessageVariables"/> gives
/// one; otherwise it is reported as missing, which makes a send leave that
/// customer out. Unknown names are left in the text and reported.
/// </summary>
public static partial class MessageTemplateRenderer
{
    [GeneratedRegex(@"\{([a-z0-9_]+)\}")]
    private static partial Regex VariablePattern();

    public static IReadOnlyList<string> FindVariables(string text) =>
        VariablePattern().Matches(text ?? string.Empty)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    public static MessageRenderResult Render(
        string text,
        IReadOnlyDictionary<string, string?> values,
        bool removeDiacritics = false)
    {
        var missing = new List<string>();
        var unknown = new List<string>();

        var rendered = VariablePattern().Replace(text ?? string.Empty, match =>
        {
            var key = match.Groups[1].Value;
            var variable = MessageVariables.Find(key);
            if (variable == null)
            {
                AddOnce(unknown, key);
                return match.Value;
            }

            var value = values.GetValueOrDefault(key)?.Trim();
            if (!string.IsNullOrEmpty(value))
            {
                return value;
            }

            if (variable.WhenEmpty == MessageVariableWhenEmpty.UseFallback && variable.Fallback != null)
            {
                return variable.Fallback;
            }

            AddOnce(missing, key);
            return match.Value;
        });

        return new MessageRenderResult(
            removeDiacritics ? StripDiacritics(rendered) : rendered,
            missing,
            unknown);
    }

    /// <summary>"Tự bỏ dấu tiếng Việt": <c>Nhắc lịch hẹn</c> → <c>Nhac lich hen</c>.</summary>
    public static string StripDiacritics(string text)
    {
        var decomposed = (text ?? string.Empty).Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(c switch
            {
                'đ' => 'd',
                'Đ' => 'D',
                _ => c,
            });
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static void AddOnce(List<string> list, string key)
    {
        if (!list.Contains(key))
        {
            list.Add(key);
        }
    }
}

public sealed record MessageRenderResult(
    string Text,
    IReadOnlyList<string> Missing,
    IReadOnlyList<string> Unknown);

/// <summary>
/// How many SMS a text costs. Text that fits the GSM 7-bit alphabet goes 160
/// characters to a message (153 each once split); anything else — Vietnamese
/// with its marks — goes as Unicode, 70 (67 each once split).
/// </summary>
public static class SmsLength
{
    private const string Gsm7Basic =
        "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
        "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

    private const string Gsm7Extension = "\f^{}\\[~]|€";

    public static SmsMeasure Measure(string text)
    {
        text ??= string.Empty;
        var septets = 0;
        foreach (var c in text)
        {
            if (Gsm7Basic.Contains(c))
            {
                septets += 1;
            }
            else if (Gsm7Extension.Contains(c))
            {
                septets += 2;
            }
            else
            {
                return Count(text.Length, single: 70, part: 67, unicode: true);
            }
        }

        return Count(septets, single: 160, part: 153, unicode: false);
    }

    private static SmsMeasure Count(int length, int single, int part, bool unicode)
    {
        if (length <= single)
        {
            return new SmsMeasure(length, length == 0 ? 0 : 1, single, unicode);
        }

        return new SmsMeasure(length, (length + part - 1) / part, single, unicode);
    }
}

/// <param name="Characters">Characters as the network counts them (GSM extension characters count twice).</param>
/// <param name="Segments">Messages the text is split into.</param>
/// <param name="PerMessage">The single-message limit for this alphabet: 160 or 70.</param>
public sealed record SmsMeasure(int Characters, int Segments, int PerMessage, bool Unicode);
