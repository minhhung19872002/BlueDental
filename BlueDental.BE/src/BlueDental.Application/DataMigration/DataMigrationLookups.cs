using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Catalogs;
using BlueDental.Catalogs.Import;

namespace BlueDental.DataMigration;

/// <summary>A catalog row the file may name, as the DanhMuc sheet lists it.</summary>
internal sealed record LookupItem(Guid Id, string Name, string? Code = null);

/// <summary>
/// The branch's live catalogs, keyed by the case- and space-insensitive name
/// the file writes. Every name the file uses must resolve here: an unknown
/// service or doctor refuses the file (BA 2026-10-08), and so does an unknown
/// source, tag or disease — a typo there would otherwise vanish silently.
/// </summary>
internal sealed class DataMigrationLookups
{
    public required IReadOnlyList<LookupItem> Services { get; init; }
    public required IReadOnlyList<LookupItem> Staff { get; init; }
    public required IReadOnlyList<LookupItem> Sources { get; init; }

    /// <summary>Kênh, per Nguồn đến id.</summary>
    public required IReadOnlyDictionary<Guid, IReadOnlyList<LookupItem>> Channels { get; init; }

    public required IReadOnlyList<LookupItem> Occupations { get; init; }
    public required IReadOnlyList<LookupItem> DiseaseHistory { get; init; }
    public required IReadOnlyList<LookupItem> Tags { get; init; }

    private Dictionary<string, LookupItem?>? _services;
    private Dictionary<string, LookupItem?>? _staff;

    private Dictionary<string, LookupItem?> ServiceIndex =>
        _services ??= Index(Services, s => s.Code is null ? [s.Name] : [s.Code, s.Name]);

    private Dictionary<string, LookupItem?> StaffIndex =>
        _staff ??= Index(Staff, s => s.Code is null ? [s.Name] : [s.Name, s.Code]);

    /// <summary>A service by its code or its name.</summary>
    public LookupItem? FindService(string text, out bool ambiguous) => Find(ServiceIndex, text, out ambiguous);

    /// <summary>A staff member of the branch by full name or user name.</summary>
    public LookupItem? FindStaff(string text, out bool ambiguous) => Find(StaffIndex, text, out ambiguous);

    public static LookupItem? FindByName(IReadOnlyList<LookupItem> items, string text) =>
        items.FirstOrDefault(item => ExcelCells.Key(item.Name) == ExcelCells.Key(text));

    /// <summary>
    /// Two rows answering to the same text — two names, two codes, or one's
    /// code and another's name — map to null, so the reader can say
    /// "ambiguous" rather than guess.
    /// </summary>
    private static Dictionary<string, LookupItem?> Index(
        IEnumerable<LookupItem> items, Func<LookupItem, string[]> keys)
    {
        var index = new Dictionary<string, LookupItem?>();
        foreach (var item in items)
        {
            foreach (var key in keys(item).Select(ExcelCells.Key).Where(k => k.Length > 0).Distinct())
            {
                if (!index.TryGetValue(key, out var existing))
                {
                    index[key] = item;
                }
                else if (existing != null && existing.Id != item.Id)
                {
                    index[key] = null;
                }
            }
        }

        return index;
    }

    private static LookupItem? Find(Dictionary<string, LookupItem?> index, string text, out bool ambiguous)
    {
        ambiguous = false;
        if (!index.TryGetValue(ExcelCells.Key(text), out var item))
        {
            return null;
        }

        ambiguous = item == null;
        return item;
    }

    public static string StaffName(string? surname, string? name, string userName)
    {
        var full = string.Join(" ", new[] { surname, name }.Where(part => !string.IsNullOrWhiteSpace(part))).Trim();
        return full.Length > 0 ? full : userName;
    }

    public static IReadOnlyList<LookupItem> Entries(IEnumerable<CatalogEntry> entries, string group) =>
        entries
            .Where(e => e.Group == group)
            .OrderBy(e => e.SortOrder)
            .ThenBy(e => e.Name)
            .Select(e => new LookupItem(e.Id, e.Name, e.Code))
            .ToList();
}
