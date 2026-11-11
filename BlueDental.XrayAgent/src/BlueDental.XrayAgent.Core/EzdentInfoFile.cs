using System.Globalization;
using System.Text;

namespace BlueDental.XrayAgent.Core;

/// <summary>What EzDent-i's picture information file says about the picture.</summary>
public sealed record EzdentInfo(string? Code, string? Name, int? BirthYear, DateTimeOffset? AcquiredAt)
{
    public bool IsEmpty => Code is null && Name is null && BirthYear is null && AcquiredAt is null;
}

/// <summary>
/// Reads the file EzDent-i writes next to an exported picture when
/// "Thêm Tệp Thông tin Hình ảnh" is ticked: same base name, one
/// <c>Key : value</c> per line — <c>Chart No</c>, <c>Name</c> (DICOM style,
/// <c>LAST FIRST^</c>), <c>Birthday</c> (yyyy-MM-dd), <c>Acquisition Date</c>
/// (ISO 8601 with offset), plus exposure values the agent ignores.
/// The export's own file name (<c>PX&lt;date&gt;_&lt;time&gt;_n_n</c>) carries no
/// chart number, so this file is where the code comes from.
/// </summary>
public static class EzdentInfoFile
{
    /// <summary>The real file is a few hundred bytes; anything far bigger is not it.</summary>
    public const int MaxBytes = 64 * 1024;

    private const int MaxNameLength = 200;
    private const int MinBirthYear = 1900;
    private static readonly string[] SkippedExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".dcm"];
    private static readonly string[] BirthdayFormats = ["yyyy-MM-dd", "yyyyMMdd", "yyyy/MM/dd", "yyyy.MM.dd"];

    /// <summary>
    /// The information file beside <paramref name="picturePath"/>, or null.
    /// A <c>.txt</c> wins when several candidates share the base name.
    /// </summary>
    public static string? FindFor(string picturePath)
    {
        var folder = Path.GetDirectoryName(picturePath);
        var baseName = Path.GetFileNameWithoutExtension(picturePath);
        if (string.IsNullOrEmpty(folder) || string.IsNullOrEmpty(baseName) || !Directory.Exists(folder))
            return null;

        try
        {
            return Directory.EnumerateFiles(folder, baseName + ".*")
                .Where(path => IsCandidate(path, baseName))
                .OrderBy(path => Path.GetExtension(path).Equals(".txt", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(path => path, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    /// <summary>Reads and parses the file; null when it is missing, too big or unreadable.</summary>
    public static EzdentInfo? TryRead(string path, int currentYear)
    {
        try
        {
            var file = new FileInfo(path);
            if (!file.Exists || file.Length > MaxBytes)
                return null;
            return Parse(Decode(File.ReadAllBytes(path)), currentYear);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public static EzdentInfo Parse(string text, int currentYear)
    {
        string? code = null, name = null;
        int? year = null;
        DateTimeOffset? acquired = null;

        foreach (var line in text.Split('\n'))
        {
            var colon = line.IndexOf(':');
            if (colon <= 0)
                continue;
            var value = line[(colon + 1)..].Trim();
            switch (KeyOf(line[..colon]))
            {
                case "chartno" or "chartnumber":
                    code ??= CleanCode(value);
                    break;
                case "name" or "patientname":
                    name ??= CleanName(value);
                    break;
                case "birthday" or "birthdate" or "dateofbirth":
                    year ??= YearOf(value, currentYear);
                    break;
                case "acquisitiondate":
                    acquired ??= DateOf(value);
                    break;
            }
        }

        return new EzdentInfo(code, name, year, acquired);
    }

    private static bool IsCandidate(string path, string baseName)
    {
        if (!Path.GetFileNameWithoutExtension(path).Equals(baseName, StringComparison.OrdinalIgnoreCase))
            return false;
        var extension = Path.GetExtension(path);
        return extension.Length > 1 && !SkippedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>UTF-8 / UTF-16 by BOM; plain bytes that are not valid UTF-8 read as Latin-1.</summary>
    private static string Decode(byte[] bytes)
    {
        if (bytes is [0xFF, 0xFE, ..])
            return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
        if (bytes is [0xFE, 0xFF, ..])
            return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
        var start = bytes is [0xEF, 0xBB, 0xBF, ..] ? 3 : 0;
        try
        {
            return new UTF8Encoding(false, true).GetString(bytes, start, bytes.Length - start);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.Latin1.GetString(bytes);
        }
    }

    private static string KeyOf(string raw) =>
        string.Concat(raw.Where(char.IsLetterOrDigit)).ToLowerInvariant();

    private static string? CleanCode(string value) => AgentLink.IsValidCode(value) ? value : null;

    /// <summary>DICOM person name: parts split by '^' (family^given^middle…).</summary>
    private static string? CleanName(string value)
    {
        var words = value.Replace('^', ' ').Replace('_', ' ')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var name = string.Join(' ', words);
        if (name.Length == 0)
            return null;
        return name.Length > MaxNameLength ? name[..MaxNameLength] : name;
    }

    private static int? YearOf(string value, int currentYear) =>
        DateOnly.TryParseExact(value, BirthdayFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
        && date.Year >= MinBirthYear && date.Year <= currentYear
            ? date.Year
            : null;

    private static DateTimeOffset? DateOf(string value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var when)
            ? when
            : null;
}
