using System;
using System.Collections.Generic;
using System.Text.Json;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Staff;

/// <summary>One field of a unit before and after a change, already in display form (names, not ids).</summary>
public sealed record OrgUnitFieldChange(string Field, string? Before, string? After);

/// <summary>
/// One line of Sơ đồ tổ chức → Lịch sử thay đổi. Written once next to the
/// change and never edited, so — like <c>AppointmentChangeLog</c> — a plain
/// entity with its own timestamp. The unit's name and kind are copied so the
/// line still reads after the unit is deleted.
/// </summary>
public class OrgUnitChangeLog : Entity<Guid>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Guid OrgUnitId { get; private set; }
    public string OrgUnitName { get; private set; } = default!;
    public OrgUnitKind OrgUnitKind { get; private set; }
    public OrgChartAction Action { get; private set; }

    /// <summary>Serialized list of <see cref="OrgUnitFieldChange"/>.</summary>
    public string ChangesJson { get; private set; } = "[]";

    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }
    public DateTime OccurredAt { get; private set; }

    protected OrgUnitChangeLog() { }

    public static OrgUnitChangeLog Record(
        Guid id,
        OrgUnit unit,
        OrgChartAction action,
        IReadOnlyList<OrgUnitFieldChange> changes,
        Guid? actorUserId,
        string? actorName,
        DateTime occurredAt)
    {
        Check.NotNull(unit, nameof(unit));
        return new OrgUnitChangeLog
        {
            Id = id,
            OrgUnitId = unit.Id,
            OrgUnitName = unit.Name,
            OrgUnitKind = unit.Kind,
            Action = action,
            ChangesJson = JsonSerializer.Serialize(changes, JsonOptions),
            ActorUserId = actorUserId,
            ActorName = actorName,
            OccurredAt = occurredAt,
        };
    }

    public IReadOnlyList<OrgUnitFieldChange> ReadChanges() =>
        JsonSerializer.Deserialize<List<OrgUnitFieldChange>>(ChangesJson, JsonOptions) ?? [];
}
