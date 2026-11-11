using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace BlueDental.XrayAgent.Core;

/// <summary>
/// The <c>bluedental-xray://open?code=…</c> link the web app's "Mở EzDent-i"
/// button opens. It carries the customer code and nothing else — no name, no
/// birthday — so the browser history and the Windows shell never see PHI.
/// </summary>
public static partial class AgentLink
{
    public const string Scheme = "bluedental-xray";
    private const int MaxLinkLength = 512;

    [GeneratedRegex(@"^[A-Za-z0-9._-]{1,32}$", RegexOptions.CultureInvariant)]
    private static partial Regex CodePattern();

    /// <summary>A code is letters, digits, dot, dash or underscore, 1–32 long.</summary>
    public static bool IsValidCode([NotNullWhen(true)] string? code) => code is not null && CodePattern().IsMatch(code);

    public static string Build(string code) => $"{Scheme}://open?code={Uri.EscapeDataString(code)}";

    public static bool TryParse(string? raw, [NotNullWhen(true)] out string? code)
    {
        code = null;
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > MaxLinkLength)
            return false;
        if (!Uri.TryCreate(raw.Trim(), UriKind.Absolute, out var uri))
            return false;
        if (!uri.Scheme.Equals(Scheme, StringComparison.OrdinalIgnoreCase)
            || !uri.Host.Equals("open", StringComparison.OrdinalIgnoreCase)
            || uri.AbsolutePath is not ("" or "/"))
            return false;

        var value = ReadQuery(uri.Query, "code");
        if (!IsValidCode(value))
            return false;

        code = value;
        return true;
    }

    private static string? ReadQuery(string query, string key)
    {
        foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = part.IndexOf('=');
            if (eq <= 0 || !part[..eq].Equals(key, StringComparison.OrdinalIgnoreCase))
                continue;
            return Uri.UnescapeDataString(part[(eq + 1)..].Replace('+', ' '));
        }

        return null;
    }
}
