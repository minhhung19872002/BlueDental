using System;
using System.Collections.Generic;
using Volo.Abp.Domain.Values;

namespace BlueDental.TreatmentManagement.Values;

/// <summary>
/// One entry of a công đoạn's "Danh sách công đoạn" — a step of the service the
/// công đoạn covers, ticked off as it is done.
///
/// OBSERVED on the reference 2026-09-07: a công đoạn carries
/// <c>stageServiceItems[]</c> of
/// <c>{ stageServiceId, isCompleted, completedAt, staffId, note }</c>, where
/// <c>stageServiceId</c> points at one of the entries the **catalog service**
/// declares (its <c>stages[]</c>: <c>{ id, name, value, valueType }</c>). The
/// entries are chosen when the công đoạn is created — every box starts
/// unticked — and each one is ticked or unticked afterwards from the treatment
/// history row's Công đoạn column.
///
/// BlueDental points <see cref="CatalogServiceStageId"/> at
/// <c>CatalogServiceStage</c>, which the taxonomy screen already owns, so the
/// names and their order come from the service and are not copied here.
/// </summary>
public class StageServiceItem : ValueObject
{
    /// <summary>The service's own công đoạn entry — the reference's stageServiceId.</summary>
    public Guid CatalogServiceStageId { get; private set; }

    public bool IsCompleted { get; private set; }

    /// <summary>When it was ticked; cleared when it is unticked again.</summary>
    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Who ticked it; cleared when it is unticked again.</summary>
    public Guid? StaffId { get; private set; }

    protected StageServiceItem() { }

    public StageServiceItem(
        Guid catalogServiceStageId,
        bool isCompleted = false,
        DateTimeOffset? completedAt = null,
        Guid? staffId = null)
    {
        CatalogServiceStageId = catalogServiceStageId;
        IsCompleted = isCompleted;
        // "Done" without a time, or a time on something not done, would both be
        // nonsense to print in the history row, so the pair is kept consistent
        // here rather than trusted from the caller.
        CompletedAt = isCompleted ? completedAt : null;
        StaffId = isCompleted ? staffId : null;
    }

    /// <summary>The same entry, ticked or unticked, as a new value.</summary>
    public StageServiceItem With(bool isCompleted, DateTimeOffset now, Guid? staffId) =>
        isCompleted
            ? new StageServiceItem(CatalogServiceStageId, true, CompletedAt ?? now, StaffId ?? staffId)
            : new StageServiceItem(CatalogServiceStageId);

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return CatalogServiceStageId;
        yield return IsCompleted;
        yield return CompletedAt;
        yield return StaffId;
    }
}
