using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using Volo.Abp.Domain.Services;

namespace BlueDental.Labo;

/// <summary>
/// What a service line's labo orders do to its công đoạn (P2910_03, owner
/// decision 9, 2026-10-30):
/// <list type="bullet">
///   <item>while an order is unfinished — not cancelled, not yet QC-passed — the
///         công đoạn that raised it and every one worked after it cannot be
///         ticked Hoàn thành; they can still be continued. The raising one was
///         exempt until the owner's 2026-10-30 review (BA: "disable checkbox
///         Hoàn thành"); those worked before it stay free;</item>
///   <item>an order raised from the patient's Labo tab has no công đoạn: it locks
///         every công đoạn of the line dated on or after the day it was written
///         (ASSUMED — docs/clone/unknowns.md);</item>
///   <item>"Kích hoạt bảo hành" is offered on the line's latest công đoạn while
///         one of its orders is QC-passed with a passed tooth still without a card.</item>
/// </list>
/// "On or after" is the order the công đoạn were worked in: treatment day, then the
/// order they were written in.
///
/// Stateless: the caller loads the line's công đoạn and orders and hands them in.
/// </summary>
public class LaboStagePolicy : IDomainService
{
    public bool LocksCompletion(
        TreatmentStage stage,
        IReadOnlyCollection<TreatmentStage> lineStages,
        IEnumerable<LaboOrder> lineOrders) =>
        lineOrders.Any(order =>
            order.IsUnfinished
            && order.TreatmentServiceId == stage.TreatmentServiceId
            && IsWorkedOnOrAfter(stage, order, lineStages));

    /// <summary>The order the công đoạn's chip names: its newest live order, else its newest cancelled one.</summary>
    public LaboOrder? OrderRaisedOn(TreatmentStage stage, IEnumerable<LaboOrder> lineOrders) =>
        lineOrders
            .Where(order => order.TreatmentStageId == stage.Id)
            .OrderBy(order => order.Status != LaboStatus.Cancelled)
            .ThenBy(order => order.CreationTime)
            .LastOrDefault();

    /// <summary>The order "Kích hoạt bảo hành" opens, when <paramref name="stage"/> is the line's latest công đoạn.</summary>
    public LaboOrder? OrderAwaitingWarranty(
        TreatmentStage stage,
        IReadOnlyCollection<TreatmentStage> lineStages,
        IEnumerable<LaboOrder> lineOrders) =>
        lineStages.MaxBy(WorkOrder)?.Id == stage.Id
            ? lineOrders.Where(order => order.HasTeethAwaitingWarranty).MaxBy(order => order.CreationTime)
            : null;

    private static bool IsWorkedOnOrAfter(
        TreatmentStage stage,
        LaboOrder order,
        IReadOnlyCollection<TreatmentStage> lineStages)
    {
        var raisedOn = lineStages.FirstOrDefault(s => s.Id == order.TreatmentStageId);
        if (raisedOn is null)
        {
            var written = DateTime.SpecifyKind(order.CreationTime, DateTimeKind.Utc);
            return stage.TreatmentDate >= ClinicCalendar.DateOf(written);
        }

        return WorkOrder(stage).CompareTo(WorkOrder(raisedOn)) >= 0;
    }

    private static (DateOnly Day, DateTime Written) WorkOrder(TreatmentStage stage) =>
        (stage.TreatmentDate, stage.CreationTime);
}
