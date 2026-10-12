using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Catalogs;
using BlueDental.DataMigration;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// Nguồn đến, kênh, nghề nghiệp, tiền sử bệnh and thẻ hồ sơ of every branch,
/// retired ones included: a patient keeps the names it was given, so the
/// export writes them and the import has to read them back. A retired name may
/// only stay on the record that already holds it — the import refuses it for
/// anyone else, as the hồ sơ dialog no longer offers it.
/// </summary>
internal sealed class PatientRosterCatalogs
{
    private readonly Dictionary<Guid, string> _names = [];
    private readonly HashSet<Guid> _retired = [];
    private readonly Dictionary<Guid, DataMigrationLookups> _lookups = [];
    private readonly List<Item> _items = [];

    public PatientRosterCatalogs(
        IEnumerable<CatalogEntry> entries,
        IEnumerable<Taxonomy> sources,
        IEnumerable<PatientTag> tags)
    {
        foreach (var entry in entries)
        {
            Add(new Item(entry.Id, entry.ClinicBranchId, entry.Group, entry.TaxonomyId, entry.Name,
                entry.SortOrder, Retired: !entry.IsActive || entry.IsDeleted));
        }

        foreach (var source in sources)
        {
            Add(new Item(source.Id, source.ClinicBranchId, SourceTaxonomy, null, source.Name,
                source.SortOrder, Retired: source.IsDeleted));
        }

        foreach (var tag in tags)
        {
            Add(new Item(tag.Id, tag.ClinicBranchId, Tag, null, tag.Name, 0, Retired: !tag.IsActive || tag.IsDeleted));
        }
    }

    /// <summary>Kinds that are not a CatalogEntry group.</summary>
    private const string SourceTaxonomy = "#source";
    private const string Tag = "#tag";

    public string? Name(Guid? id) => id is { } value ? _names.GetValueOrDefault(value) : null;

    public bool IsRetired(Guid id) => _retired.Contains(id);

    /// <summary>The branch's names for the row reader; live ones first, so a name reused after retiring resolves to the live row.</summary>
    public DataMigrationLookups For(Guid branchId)
    {
        if (_lookups.TryGetValue(branchId, out var cached))
        {
            return cached;
        }

        var items = _items.Where(i => i.BranchId == branchId).ToList();
        var sources = Pick(items, SourceTaxonomy);
        var lookups = new DataMigrationLookups
        {
            Services = [],
            Staff = [],
            Sources = sources,
            Channels = sources.ToDictionary(
                s => s.Id,
                s => Pick(items.Where(i => i.TaxonomyId == s.Id), TaxonomyGroups.Source)),
            Occupations = Pick(items, TaxonomyGroups.Occupation),
            DiseaseHistory = Pick(items, TaxonomyGroups.DiseaseHistory),
            Tags = Pick(items, Tag)
        };

        _lookups[branchId] = lookups;
        return lookups;
    }

    private void Add(Item item)
    {
        _items.Add(item);
        _names[item.Id] = item.Name;
        if (item.Retired)
        {
            _retired.Add(item.Id);
        }
    }

    private static IReadOnlyList<LookupItem> Pick(IEnumerable<Item> items, string kind) =>
        items
            .Where(i => i.Kind == kind)
            .OrderBy(i => i.Retired)
            .ThenBy(i => i.SortOrder)
            .ThenBy(i => i.Name)
            .Select(i => new LookupItem(i.Id, i.Name))
            .ToList();

    private sealed record Item(
        Guid Id, Guid BranchId, string Kind, Guid? TaxonomyId, string Name, int SortOrder, bool Retired);
}
