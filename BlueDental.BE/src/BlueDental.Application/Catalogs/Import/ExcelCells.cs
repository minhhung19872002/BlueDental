using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace BlueDental.Catalogs.Import;

/// <summary>
/// Reads what a clinic actually types into Excel: "1.500.000" as well as
/// 1500000, "Có" as well as TRUE, a bold run inside a cell as HTML.
/// </summary>
internal static partial class ExcelCells
{
    /// <summary>Trimmed cell text, or null when the cell is blank. Numbers come back invariant ("1500000", "1.5").</summary>
    public static string? Text(IXLCell? cell)
    {
        if (cell == null || cell.IsEmpty())
        {
            return null;
        }

        var value = cell.Value;
        var text = value.Type switch
        {
            XLDataType.Blank => null,
            XLDataType.Text => value.GetText(),
            XLDataType.Number => value.GetNumber().ToString("0.############", CultureInfo.InvariantCulture),
            XLDataType.Boolean => value.GetBoolean() ? "TRUE" : "FALSE",
            XLDataType.DateTime => value.GetDateTime().ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            XLDataType.TimeSpan => value.GetTimeSpan().ToString(),
            _ => null
        };

        text = text?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    /// <summary>
    /// The cell as the rich-text editor would have produced it: one paragraph
    /// per line, bold / italic / underline / strikethrough runs kept. A plain
    /// cell becomes plain paragraphs. Null when blank.
    /// </summary>
    public static string? Html(IXLCell? cell)
    {
        if (cell == null || cell.IsEmpty())
        {
            return null;
        }

        var paragraphs = new List<StringBuilder> { new() };

        if (cell.HasRichText)
        {
            foreach (var run in cell.GetRichText())
            {
                AppendRun(paragraphs, run.Text, run.Bold, run.Italic,
                    run.Underline != XLFontUnderlineValues.None, run.Strikethrough);
            }
        }
        else
        {
            AppendRun(paragraphs, Text(cell) ?? string.Empty, false, false, false, false);
        }

        var html = string.Concat(paragraphs
            .Select(p => p.ToString())
            .Where(p => p.Length > 0)
            .Select(p => $"<p>{p}</p>"));
        return html.Length == 0 ? null : html;
    }

    private static void AppendRun(
        List<StringBuilder> paragraphs, string text, bool bold, bool italic, bool underline, bool strike)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            if (i > 0)
            {
                paragraphs.Add(new StringBuilder());
            }

            if (lines[i].Length == 0)
            {
                continue;
            }

            var encoded = HtmlText(lines[i]);
            if (bold) encoded = $"<strong>{encoded}</strong>";
            if (italic) encoded = $"<em>{encoded}</em>";
            if (underline) encoded = $"<u>{encoded}</u>";
            if (strike) encoded = $"<s>{encoded}</s>";
            paragraphs[^1].Append(encoded);
        }
    }

    /// <summary>
    /// Only the four characters HTML itself reads are escaped. The editor stores
    /// Vietnamese as-is, so a numeric entity per accented letter would be noise.
    /// </summary>
    private static string HtmlText(string text) =>
        text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

    /// <summary>Header and lookup keys: case, accents kept, inner whitespace collapsed.</summary>
    public static string Key(string? text) =>
        text == null ? string.Empty : Whitespace().Replace(text.Trim(), " ").ToLowerInvariant();

    /// <summary>
    /// "1.500.000", "1,500,000", "1500000", "1.500.000,5", "1500000 đ" all read as
    /// money. A lone separator followed by anything but three digits is a
    /// decimal point ("1.5"), the way people type it.
    /// </summary>
    public static bool TryMoney(string? text, out decimal value)
    {
        value = 0m;
        if (text == null)
        {
            return true;
        }

        var s = Currency().Replace(text, string.Empty).Trim();
        if (s.Length == 0)
        {
            return true;
        }

        var lastDot = s.LastIndexOf('.');
        var lastComma = s.LastIndexOf(',');
        if (lastDot >= 0 && lastComma >= 0)
        {
            // Both present: the later one is the decimal point.
            s = lastComma > lastDot
                ? s.Replace(".", string.Empty).Replace(',', '.')
                : s.Replace(",", string.Empty);
        }
        else if (lastDot >= 0 || lastComma >= 0)
        {
            var sep = lastDot >= 0 ? '.' : ',';
            var parts = s.Split(sep);
            var thousands = parts.Length > 1 && parts.Skip(1).All(p => p.Length == 3);
            s = thousands ? s.Replace(sep.ToString(), string.Empty) : s.Replace(',', '.');
        }

        return decimal.TryParse(s, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture, out value);
    }

    public static bool TryInteger(string? text, out int value)
    {
        value = 0;
        if (!TryMoney(text, out var number) || number != decimal.Truncate(number)
            || number > int.MaxValue || number < int.MinValue)
        {
            return false;
        }

        value = (int)number;
        return true;
    }

    private static readonly HashSet<string> TrueWords =
        ["có", "co", "x", "1", "true", "yes", "y", "đúng", "dung"];

    private static readonly HashSet<string> FalseWords =
        ["không", "khong", "0", "false", "no", "n", "sai", "-"];

    /// <summary>Blank reads as false — an unticked box.</summary>
    public static bool TryBool(string? text, out bool value)
    {
        value = false;
        if (text == null)
        {
            return true;
        }

        var key = Key(text);
        if (TrueWords.Contains(key))
        {
            value = true;
            return true;
        }

        return FalseWords.Contains(key);
    }

    public static bool TryTaxRate(string? text, out ServiceTaxRate value)
    {
        value = ServiceTaxRate.NotTaxable;
        if (text == null)
        {
            return true;
        }

        var key = Key(text).Replace(" ", string.Empty).Replace("%", string.Empty);
        switch (key)
        {
            case "kct": value = ServiceTaxRate.NotTaxable; return true;
            case "kkknt": value = ServiceTaxRate.NotDeclared; return true;
            case "0": value = ServiceTaxRate.Zero; return true;
            case "5": value = ServiceTaxRate.Five; return true;
            case "8": value = ServiceTaxRate.Eight; return true;
            case "10": value = ServiceTaxRate.Ten; return true;
            default: return false;
        }
    }

    private static readonly Dictionary<string, PrescriptionUsage> UsageWords = new()
    {
        ["sau khi ăn"] = PrescriptionUsage.AfterMeal,
        ["sau ăn"] = PrescriptionUsage.AfterMeal,
        ["aftermeal"] = PrescriptionUsage.AfterMeal,
        ["trước khi ăn"] = PrescriptionUsage.BeforeMeal,
        ["trước ăn"] = PrescriptionUsage.BeforeMeal,
        ["beforemeal"] = PrescriptionUsage.BeforeMeal,
        ["trong khi ăn"] = PrescriptionUsage.DuringMeal,
        ["trong bữa ăn"] = PrescriptionUsage.DuringMeal,
        ["duringmeal"] = PrescriptionUsage.DuringMeal,
        ["sau khi thức dậy"] = PrescriptionUsage.AfterWakingUp,
        ["afterwakingup"] = PrescriptionUsage.AfterWakingUp,
        ["trước khi ngủ"] = PrescriptionUsage.BeforeSleep,
        ["beforesleep"] = PrescriptionUsage.BeforeSleep,
        ["khác"] = PrescriptionUsage.Other,
        ["other"] = PrescriptionUsage.Other
    };

    /// <summary>"Sau khi ăn; Trước khi ngủ" → the two flags. The first word that matches nothing is reported.</summary>
    public static bool TryUsage(string? text, out PrescriptionUsage value, out string? unknownWord)
    {
        value = PrescriptionUsage.None;
        unknownWord = null;
        if (text == null)
        {
            return true;
        }

        foreach (var word in text.Split([';', ',', '|', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var key = Key(word);
            if (key.Length == 0)
            {
                continue;
            }

            if (!UsageWords.TryGetValue(key, out var flag)
                && !UsageWords.TryGetValue(key.Replace(" ", string.Empty), out flag))
            {
                unknownWord = word.Trim();
                return false;
            }

            value |= flag;
        }

        return true;
    }

    /// <summary>"Lấy dấu: 500000; Gắn: 1.500.000" → the stages in order. Null on a malformed piece.</summary>
    public static List<(string Name, decimal Value)>? Stages(string? text)
    {
        var stages = new List<(string, decimal)>();
        if (text == null)
        {
            return stages;
        }

        foreach (var piece in text.Split([';', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (piece.Trim().Length == 0)
            {
                continue;
            }

            var colon = piece.LastIndexOf(':');
            var name = (colon < 0 ? piece : piece[..colon]).Trim();
            var amount = colon < 0 ? null : piece[(colon + 1)..].Trim();
            if (name.Length == 0 || !TryMoney(amount, out var value) || value < 0m)
            {
                return null;
            }

            stages.Add((name, value));
        }

        return stages;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"[\s₫đĐ]|vnd|vnđ", RegexOptions.IgnoreCase)]
    private static partial Regex Currency();
}
