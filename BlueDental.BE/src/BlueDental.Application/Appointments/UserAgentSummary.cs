using System;
using System.Text.RegularExpressions;

namespace BlueDental.Appointments;

/// <summary>
/// The little the history needs from a User-Agent string: which browser,
/// which operating system, and whether it looks like a phone. Names only,
/// no versions: the reference's panel reads "Chrome trên Windows". A full
/// parser is not worth a dependency for three fields shown in a side panel.
/// </summary>
public sealed record UserAgentSummary(string? Browser, string? OperatingSystem, bool IsMobile)
{
    private static readonly (Regex Pattern, string Name)[] Browsers =
    [
        (new Regex(@"Edg(?:e|A|iOS)?/(\d+)", RegexOptions.Compiled), "Edge"),
        (new Regex(@"OPR/(\d+)", RegexOptions.Compiled), "Opera"),
        (new Regex(@"SamsungBrowser/(\d+)", RegexOptions.Compiled), "Samsung Internet"),
        (new Regex(@"CriOS/(\d+)", RegexOptions.Compiled), "Chrome"),
        (new Regex(@"FxiOS/(\d+)", RegexOptions.Compiled), "Firefox"),
        (new Regex(@"Firefox/(\d+)", RegexOptions.Compiled), "Firefox"),
        (new Regex(@"Chrome/(\d+)", RegexOptions.Compiled), "Chrome"),
        (new Regex(@"Version/(\d+).*Safari", RegexOptions.Compiled), "Safari"),
    ];

    private static readonly (Regex Pattern, string Name)[] Systems =
    [
        (new Regex(@"Windows", RegexOptions.Compiled), "Windows"),
        (new Regex(@"Android (\d+)", RegexOptions.Compiled), "Android"),
        (new Regex(@"iPhone OS (\d+)", RegexOptions.Compiled), "iOS"),
        (new Regex(@"iPad", RegexOptions.Compiled), "iPadOS"),
        (new Regex(@"Mac OS X (\d+)", RegexOptions.Compiled), "macOS"),
        (new Regex(@"CrOS", RegexOptions.Compiled), "Chrome OS"),
        (new Regex(@"Linux", RegexOptions.Compiled), "Linux"),
    ];

    private static readonly Regex Mobile = new(@"Mobi|Android|iPhone|iPad|iPod", RegexOptions.Compiled);

    public static UserAgentSummary Parse(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return new UserAgentSummary(null, null, false);
        }

        return new UserAgentSummary(
            FirstMatch(Browsers, userAgent),
            FirstMatch(Systems, userAgent),
            Mobile.IsMatch(userAgent));
    }

    private static string? FirstMatch((Regex Pattern, string Name)[] candidates, string userAgent)
    {
        foreach (var (pattern, name) in candidates)
        {
            if (pattern.IsMatch(userAgent))
            {
                return name;
            }
        }

        return null;
    }
}
