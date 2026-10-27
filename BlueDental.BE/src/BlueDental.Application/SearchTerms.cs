using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace BlueDental;

/// <summary>
/// Turns what somebody typed into a search box into the terms a row has to
/// match.
///
/// Neither the whitespace around what they typed nor the case they happened to
/// use is part of what they meant, so both are dropped here and every
/// comparison downstream is made in lower case. PostgreSQL's <c>lower()</c>
/// runs under a UTF-8 collation, so it folds Vietnamese the same way
/// <see cref="string.ToLowerInvariant"/> does on this side — "ĐIỀU" and "điều"
/// meet in the middle.
///
/// Several words mean several terms, and a row matches only when it carries all
/// of them — in any of its searchable fields, in any order. "răng trám" finds
/// "Trám răng composite".
/// </summary>
public static class SearchTerms
{
    public static IReadOnlyList<string> From(string? filter)
    {
        if (string.IsNullOrWhiteSpace(filter))
        {
            return Array.Empty<string>();
        }

        return filter
            .ToLowerInvariant()
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Distinct()
            .ToList();
    }

    /// <summary>
    /// Case- and mark-blind form of a text, for the few searches matched in
    /// memory rather than in the database (where <see cref="DbText.Unaccent"/>
    /// does the job): "Văn Định" and "van dinh" fold to the same "van dinh",
    /// whether the marks came precomposed or as combining characters (R-1051).
    /// </summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(text.Length);
        foreach (var c in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(c is 'đ' or 'Đ' ? 'd' : c);
        }

        return builder.ToString().ToLowerInvariant();
    }
}
