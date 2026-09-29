using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.EInvoicing;

/// <summary>
/// "Số tiền bằng chữ" the way a Vietnamese invoice spells it:
/// 220000 → "Hai trăm hai mươi nghìn đồng". Whole đồng only; the sign is ignored.
/// Mirrors the frontend's <c>moneyWords.ts</c> so a receipt and its e-invoice read alike.
/// </summary>
public static class VietnameseAmountWords
{
    private static readonly string[] Digits =
        ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

    private static readonly string[] Scales = ["", "nghìn", "triệu"];

    public static string Spell(decimal amount)
    {
        var value = decimal.Truncate(Math.Abs(amount));
        if (value == 0m)
        {
            return "Không đồng";
        }

        var groups = GroupsOf(value);
        var words = new List<string>();

        for (var index = groups.Count - 1; index >= 0; index--)
        {
            var group = groups[index];
            if (group == 0)
            {
                continue;
            }

            words.Add(ReadGroup(group, full: index < groups.Count - 1));
            var scale = ScaleOf(index);
            if (scale.Length > 0)
            {
                words.Add(scale);
            }
        }

        var text = string.Join(' ', words) + " đồng";
        return char.ToUpperInvariant(text[0]) + text[1..];
    }

    /// <summary>Groups of three digits, units first.</summary>
    private static List<int> GroupsOf(decimal value)
    {
        var groups = new List<int>();
        for (var rest = value; rest > 0m; rest = decimal.Truncate(rest / 1000m))
        {
            groups.Add((int)(rest % 1000m));
        }

        return groups;
    }

    /// <summary>"nghìn", "triệu", "tỷ", "nghìn tỷ"… for the group at <paramref name="index"/>.</summary>
    private static string ScaleOf(int index)
    {
        var billions = index / 3;
        var parts = new List<string> { Scales[index % 3] };
        parts.AddRange(Enumerable.Repeat("tỷ", billions));
        return string.Join(' ', parts.Where(p => p.Length > 0));
    }

    /// <summary>One group; <paramref name="full"/> reads a leading "không trăm" after a higher group.</summary>
    private static string ReadGroup(int group, bool full)
    {
        var hundreds = group / 100;
        var tens = group / 10 % 10;
        var units = group % 10;
        var words = new List<string>();

        if (hundreds > 0 || full)
        {
            words.Add(Digits[hundreds]);
            words.Add("trăm");
        }

        if (tens == 0)
        {
            if (units > 0)
            {
                if (hundreds > 0 || full)
                {
                    words.Add("lẻ");
                }

                words.Add(Digits[units]);
            }

            return string.Join(' ', words);
        }

        if (tens == 1)
        {
            words.Add("mười");
        }
        else
        {
            words.Add(Digits[tens]);
            words.Add("mươi");
        }

        if (units == 1 && tens > 1)
        {
            words.Add("mốt");
        }
        else if (units == 5)
        {
            words.Add("lăm");
        }
        else if (units > 0)
        {
            words.Add(Digits[units]);
        }

        return string.Join(' ', words);
    }
}
