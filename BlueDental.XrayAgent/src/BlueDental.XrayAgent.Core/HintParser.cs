using System.Globalization;
using System.Text.RegularExpressions;

namespace BlueDental.XrayAgent.Core;

/// <summary>What a picture's file name says about whose it is.</summary>
public sealed record FileNameHints(string? Code, string? Name, int? BirthYear)
{
    public static readonly FileNameHints None = new(null, null, null);
}

/// <summary>
/// Reads <see cref="FileNameHints"/> off a file name with the configured
/// regex (groups <c>code</c>, <c>name</c>, <c>year</c>). The server matches on
/// the code only; name and year are just suggestions for staff.
/// </summary>
public sealed class HintParser
{
    private const int MaxNameLength = 200;
    private const int MinBirthYear = 1900;
    private static readonly TimeSpan MatchTimeout = TimeSpan.FromMilliseconds(250);
    private const RegexOptions Options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    private readonly Regex _regex;
    private readonly bool _codeFromParentFolder;

    public HintParser(string pattern, bool codeFromParentFolder)
    {
        _regex = new Regex(pattern, Options, MatchTimeout);
        _codeFromParentFolder = codeFromParentFolder;
    }

    /// <summary>Null when the pattern is usable, otherwise why not.</summary>
    public static string? Validate(string pattern)
    {
        try
        {
            _ = new Regex(pattern, Options, MatchTimeout);
            return null;
        }
        catch (ArgumentException e)
        {
            return e.Message;
        }
    }

    public FileNameHints Parse(string filePath, int currentYear)
    {
        var own = Read(Path.GetFileNameWithoutExtension(filePath), currentYear);
        if (!_codeFromParentFolder || own.Code is not null)
            return own;

        var folder = Read(Path.GetFileName(Path.GetDirectoryName(filePath)) ?? string.Empty, currentYear);
        return new FileNameHints(folder.Code, own.Name ?? folder.Name, own.BirthYear ?? folder.BirthYear);
    }

    private FileNameHints Read(string text, int currentYear)
    {
        if (string.IsNullOrEmpty(text))
            return FileNameHints.None;

        Match match;
        try
        {
            match = _regex.Match(text);
        }
        catch (RegexMatchTimeoutException)
        {
            return FileNameHints.None;
        }

        if (!match.Success)
            return FileNameHints.None;

        return new FileNameHints(
            CleanCode(GroupOf(match, "code")),
            CleanName(GroupOf(match, "name")),
            CleanYear(GroupOf(match, "year"), currentYear));
    }

    private static string? GroupOf(Match match, string name)
    {
        var group = match.Groups[name];
        return group.Success ? group.Value : null;
    }

    private static string? CleanCode(string? raw)
    {
        var value = raw?.Trim();
        return AgentLink.IsValidCode(value) ? value : null;
    }

    private static string? CleanName(string? raw)
    {
        if (raw is null)
            return null;
        var words = raw.Replace('_', ' ').Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var name = string.Join(' ', words);
        if (name.Length == 0)
            return null;
        return name.Length > MaxNameLength ? name[..MaxNameLength] : name;
    }

    private static int? CleanYear(string? raw, int currentYear) =>
        int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var year)
        && year >= MinBirthYear && year <= currentYear
            ? year
            : null;
}
