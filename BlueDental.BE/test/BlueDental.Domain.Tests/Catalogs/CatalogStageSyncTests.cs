using System;
using System.Linq;
using BlueDental.Catalogs;
using Xunit;

namespace BlueDental.Domain.Tests.Catalogs;

/// <summary>
/// Saving a service's stage table keeps each step's id. A công đoạn points at
/// the steps it ticked by id; re-creating them on every save left those
/// pointers dangling, and the checklists drew blank boxes.
/// </summary>
public class CatalogStageSyncTests
{
    private static int _next;
    private static Guid NewId() => new($"00000000-0000-0000-0000-{++_next:D12}");

    private static CatalogStageRow Row(Guid id, string name, decimal value,
        ServiceStageValueType type = ServiceStageValueType.Percentage, bool marketing = false)
        => new(id, name, value, type, marketing);

    private static CatalogEntry ServiceWith(params string[] steps)
    {
        var entry = CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "care_service", "Tẩy trắng");
        entry.SyncStages(steps.Select(name => Row(Guid.Empty, name, 0m)), NewId);
        return entry;
    }

    [Fact]
    public void An_unchanged_or_renamed_step_keeps_its_id()
    {
        var entry = ServiceWith("Lấy dấu", "Lắp");
        var first = entry.Stages[0].Id;
        var second = entry.Stages[1].Id;

        entry.SyncStages(new[] { Row(first, "Lấy dấu", 0m), Row(second, "Lắp răng", 10m) }, NewId);

        Assert.Equal(new[] { first, second }, entry.Stages.OrderBy(s => s.SortOrder).Select(s => s.Id));
        var renamed = entry.Stages.Single(s => s.Id == second);
        Assert.Equal("Lắp răng", renamed.Name);
        Assert.Equal(10m, renamed.Value);
    }

    [Fact]
    public void A_new_row_gets_a_new_id_and_a_missing_row_is_removed()
    {
        var entry = ServiceWith("Lấy dấu", "Lắp");
        var kept = entry.Stages[1].Id;

        entry.SyncStages(new[] { Row(kept, "Lắp", 0m), Row(Guid.Empty, "Kiểm tra", 0m) }, NewId);

        var ordered = entry.Stages.OrderBy(s => s.SortOrder).ToList();
        Assert.Equal(2, ordered.Count);
        Assert.Equal(kept, ordered[0].Id);
        Assert.Equal(0, ordered[0].SortOrder);
        Assert.Equal("Kiểm tra", ordered[1].Name);
        Assert.NotEqual(kept, ordered[1].Id);
    }

    [Fact]
    public void An_id_from_another_service_is_treated_as_a_new_row()
    {
        var entry = ServiceWith("Lấy dấu");
        var stranger = Guid.NewGuid();

        entry.SyncStages(new[] { Row(stranger, "Lấy dấu", 0m) }, NewId);

        Assert.Single(entry.Stages);
        Assert.NotEqual(stranger, entry.Stages[0].Id);
    }
}
