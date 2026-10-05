using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.CustomerCare;

/// <summary>
/// Lịch sử liên hệ — one row each time a care task's contact state changes:
/// who flipped it (<c>CreatorId</c>), when, to what, and an optional note.
/// Append-only; the screen that reads it is still to be designed (owner,
/// 2026-10-05).
/// </summary>
public class CareContactLog : CreationAuditedAggregateRoot<Guid>
{
    public Guid CareRecordId { get; private set; }
    public Guid BranchId { get; private set; }

    /// <summary>The task's status right after the change.</summary>
    public CareStatus Status { get; private set; }

    public string? Note { get; private set; }

    protected CareContactLog() { }

    private CareContactLog(Guid id, Guid careRecordId, Guid branchId, CareStatus status, string? note)
        : base(id)
    {
        CareRecordId = careRecordId;
        BranchId = branchId;
        Status = status;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    /// <summary>Records the state <paramref name="record"/> is in now.</summary>
    public static CareContactLog Of(Guid id, CareRecord record, string? note = null) =>
        new(id, record.Id, record.BranchId, record.Status, note);
}
