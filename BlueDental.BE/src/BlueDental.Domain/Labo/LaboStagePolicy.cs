using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using Volo.Abp.Domain.Services;

namespace BlueDental.Labo;

/// <summary>
/// What a service line's labo orders do to its công đoạn (P2910_03 owner
/// decision 9, reworked by P3110 note 27, 2026-10-31):
/// <list type="bullet">
///   <item>the công đoạn that raised an order and every one worked after it
///         cannot be ticked Hoàn thành until the order has passed QC for every
///         tooth — and then only on a công đoạn dated on or after the day it
///         passed: "ngày 10 pass 1 răng → ngày 10 vẫn khoá; ngày 11 pass hết →
///         ngày 11 mới cho Hoàn thành". Those worked before the raising one
///         stay free; a cancelled order locks nothing;</item>
///   <item>an order raised from the patient's Labo tab has no công đoạn: it locks
///         every công đoạn of the line dated on or after the day it was written
///         (ASSUMED — docs/clone/unknowns.md).</item>
/// </list>
/// "On or after" is the order the công đoạn were worked in: treatment day, then the
/// order they were written in.
///
/// Stateless: the caller loads the line's công đoạn and orders — with their
/// teeth, which date the QC pass — and hands them in.
/// </summary>
public class LaboStagePolicy : IDomainService
{
    public bool LocksCompletion(
        TreatmentStage stage,
        IReadOnlyCollection<TreatmentStage> lineStages,
        IEnumerable<LaboOrder> lineOrders) =>
        LockingOrder(stage, lineStages, lineOrders) is not null;

    /// <summary>
    /// The order the "🔒 Khoá: LABO-xxx chưa kiểm tra" note names (mock m38): the
    /// newest one still holding <paramref name="stage"/> back, unfinished ones first.
    /// </summary>
    public LaboOrder? LockingOrder(
        TreatmentStage stage,
        IReadOnlyCollection<TreatmentStage> lineStages,
        IEnumerable<LaboOrder> lineOrders) =>
        lineOrders
            .Where(order => order.TreatmentServiceId == stage.TreatmentServiceId
                && Holds(order, stage)
                && IsWorkedOnOrAfter(stage, order, lineStages))
            .OrderBy(order => order.IsUnfinished)
            .ThenBy(order => order.CreationTime)
            .LastOrDefault();

    /// <summary>The order the công đoạn's chip names: its newest live order, else its newest cancelled one.</summary>
    public LaboOrder? OrderRaisedOn(TreatmentStage stage, IEnumerable<LaboOrder> lineOrders) =>
        lineOrders
            .Where(order => order.TreatmentStageId == stage.Id)
            .OrderBy(order => order.Status != LaboStatus.Cancelled)
            .ThenBy(order => order.CreationTime)
            .LastOrDefault();

    /// <summary>Unfinished, or passed only after the day the công đoạn was worked.</summary>
    private static bool Holds(LaboOrder order, TreatmentStage stage) =>
        order.IsUnfinished
        || (order.QualityPassedOn is { } passedOn && stage.TreatmentDate < passedOn);

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
