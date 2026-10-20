using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Ngày bắt đầu điều trị" and "Ngày kết thúc điều trị" of a bộ hồ sơ bệnh án,
/// as the clinic set them out in save/P1810.drawio.
///
/// <list type="bullet">
///   <item>The start is the oldest công đoạn of every slip the set holds.</item>
///   <item>A slip ends once every service on it is finished; its end is the day
///         its last service was finished. Warranty work does not count: a
///         warranty visit neither reopens the slip nor moves its end.</item>
///   <item>The set ends only when every slip it holds has ended — a slip added
///         later and not yet finished takes the end date off the sheets — and
///         then on the latest of their ends. Each finished slip keeps its own end
///         either way, so the earlier treatment's end is never lost.</item>
/// </list>
/// </summary>
public static class MedicalRecordTreatmentDates
{
    /// <summary>A line still on the slip: not cancelled, converted or moved to another slip.</summary>
    public static bool Counts(TreatmentService line) =>
        line.Status is not (TreatmentServiceStatus.Cancelled
            or TreatmentServiceStatus.Replaced
            or TreatmentServiceStatus.Transferred);

    /// <summary>
    /// A slip the sheets still print and wait for: not cancelled, and with a
    /// service left on it. Cancelling a slip leaves it in its set, and one whose
    /// services were all cancelled has nothing left to finish — neither may hold
    /// the end date back.
    /// </summary>
    public static bool Counts(TreatmentPlan plan) =>
        plan.Status != TreatmentPlanStatus.Cancelled && plan.Services.Any(Counts);

    /// <summary>The oldest day any of these công đoạn was worked.</summary>
    public static DateOnly? StartOf(IEnumerable<TreatmentStage> stages)
    {
        var days = stages.Select(stage => stage.TreatmentDate).ToList();
        return days.Count == 0 ? null : days.Min();
    }

    /// <summary>
    /// The day the slip's last service was finished, or null while one is still
    /// being treated. <paramref name="stages"/> may hold other slips' công đoạn.
    /// </summary>
    public static DateOnly? EndOf(TreatmentPlan plan, IReadOnlyCollection<TreatmentStage> stages)
    {
        var lines = plan.Services.Where(Counts).ToList();
        if (lines.Count == 0) return null;

        var ends = lines.Select(line => EndOf(line, stages)).ToList();
        return ends.Any(end => end is null) ? null : ends.Max();
    }

    /// <summary>The set's end: the latest slip end, once every slip has one.</summary>
    public static DateOnly? EndOfAll(IReadOnlyCollection<DateOnly?> planEnds) =>
        planEnds.Count == 0 || planEnds.Any(end => end is null) ? null : planEnds.Max();

    private static DateOnly? EndOf(TreatmentService line, IReadOnlyCollection<TreatmentStage> stages)
    {
        var own = stages.Where(stage => stage.TreatmentServiceId == line.Id).ToList();
        var work = own.Where(stage => !stage.IsGuarantee).ToList();

        if (!IsFinished(line, own, work)) return null;

        var worked = work
            .Where(stage => stage.Status == TreatmentStageStatus.Completed)
            .Select(stage => stage.TreatmentDate)
            .ToList();
        if (worked.Count > 0) return worked.Max();

        // Ticked done on the slip without a công đoạn: the day it was ticked.
        var ticked = line.LastModificationTime ?? line.CreationTime;
        return ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(ticked, DateTimeKind.Utc)));
    }

    /// <summary>
    /// Done, or in warranty — or reopened by nothing but a warranty visit.
    ///
    /// Opening a warranty công đoạn puts the line back to "đang điều trị", and
    /// closing it marks the line done again, so the line's status alone cannot
    /// say whether the treatment itself is over. A line a warranty has reopened
    /// is finished when its own work is: every live công đoạn closed, and every
    /// tooth of the line worked — as the slip itself decides it.
    /// </summary>
    private static bool IsFinished(
        TreatmentService line,
        IReadOnlyCollection<TreatmentStage> own,
        IReadOnlyCollection<TreatmentStage> work)
    {
        if (line.Status is TreatmentServiceStatus.Done or TreatmentServiceStatus.Warranty) return true;
        if (line.Status != TreatmentServiceStatus.InProgress || !own.Any(stage => stage.IsGuarantee)) return false;

        var live = work.Where(stage => !stage.IsSuperseded).ToList();
        var worked = work
            .SelectMany(stage => stage.Teeth.Count == 0 ? line.Teeth : stage.Teeth)
            .Select(tooth => tooth.ToothCode)
            .ToHashSet();

        return live.Count > 0
            && live.TrueForAll(stage => stage.Status == TreatmentStageStatus.Completed)
            && line.Teeth.All(tooth => worked.Contains(tooth.ToothCode));
    }
}
