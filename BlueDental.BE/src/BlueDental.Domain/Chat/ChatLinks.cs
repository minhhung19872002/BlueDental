using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace BlueDental.Chat;

/// <summary>
/// Finds the web links in a message's text for Kho lưu trữ (R-1160). Only
/// http and https come out, so a "javascript:" or "file:" string typed into
/// a message never turns into something clickable.
/// </summary>
public static partial class ChatLinks
{
    private const string TrailingPunctuation = ".,;:!?'\"…";

    public static IReadOnlyList<string> Find(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return [];
        }

        var found = new List<string>();
        foreach (Match match in Candidate().Matches(text))
        {
            var url = Normalize(Trim(match.Value));
            if (url is not null && !found.Contains(url))
            {
                found.Add(url);
            }
        }

        return found;
    }

    /// <summary>Drops the sentence's own punctuation and a closing bracket the link did not open.</summary>
    private static string Trim(string raw)
    {
        var end = raw.Length;
        while (end > 0)
        {
            var last = raw[end - 1];
            if (TrailingPunctuation.Contains(last)
                || (Closing(last) is { } open && Count(raw, open, end) < Count(raw, last, end)))
            {
                end--;
                continue;
            }

            break;
        }

        return raw[..end];
    }

    private static string? Normalize(string candidate)
    {
        var withScheme = candidate.StartsWith("www.", StringComparison.OrdinalIgnoreCase)
            ? "https://" + candidate
            : candidate;
        if (withScheme.Length > ChatConsts.MaxLinkLength
            || !Uri.TryCreate(withScheme, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || string.IsNullOrEmpty(uri.Host)
            || !uri.Host.Contains('.'))
        {
            return null;
        }

        return withScheme;
    }

    private static char? Closing(char c) => c switch
    {
        ')' => '(',
        ']' => '[',
        '}' => '{',
        _ => null,
    };

    private static int Count(string s, char c, int end)
    {
        var n = 0;
        for (var i = 0; i < end; i++)
        {
            if (s[i] == c)
            {
                n++;
            }
        }

        return n;
    }

    [GeneratedRegex(@"(?<![\w@/])(?:https?://|www\.)[^\s<>""`]+", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 200)]
    private static partial Regex Candidate();
}
