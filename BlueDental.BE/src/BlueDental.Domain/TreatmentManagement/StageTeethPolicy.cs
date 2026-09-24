using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Which teeth a new công đoạn may take on its service line.
///
/// Measured on staging 2026-09-24 (the reference's own stage modal, read from
/// its published chunk and exercised on a record the project owner named):
/// <list type="bullet">
///   <item>"THÊM CÔNG ĐOẠN" offers a line's teeth **minus** the teeth its công
///         đoạn already hold, so a line of 21·22·23 whose first công đoạn took
///         21·23 is offered again with 22 alone;</item>
///   <item>the teeth of a new công đoạn are picked among those — the doctor may
///         take fewer than all of them;</item>
///   <item>a warranty ("Tạo bảo hành") picks its teeth among the root công
///         đoạn's, and cannot be raised while another warranty of the same line
///         is still open ("Vui lòng hoàn thành bảo hành đang mở trước khi tạo
///         bảo hành mới"), nor once the service's warranty period has run out.</item>
/// </list>
///
/// Stateless: the caller loads the line and its công đoạn and hands them in.
/// </summary>
public class StageTeethPolicy : IDomainService
{
    /// <summary>
    /// The tooth codes a line's công đoạn already hold. A công đoạn written with
    /// no teeth at all predates per-tooth công đoạn and stood for the whole line,
    /// so it still covers every tooth the line has.
    /// </summary>
    public IReadOnlySet<int> CoveredTeeth(
        IReadOnlyCollection<ToothSelection> lineTeeth,
        IEnumerable<TreatmentStage> lineStages)
    {
        var covered = new HashSet<int>();
        foreach (var stage in lineStages)
        {
            if (stage.Teeth.Count == 0)
            {
                covered.UnionWith(lineTeeth.Select(t => t.ToothCode));
                continue;
            }

            covered.UnionWith(stage.Teeth.Select(t => t.ToothCode));
        }

        return covered;
    }

    /// <summary>"Thêm công đoạn": teeth of the line that no công đoạn holds yet.</summary>
    public void EnsureNewStageTeeth(
        IReadOnlyCollection<ToothSelection> lineTeeth,
        IEnumerable<TreatmentStage> lineStages,
        IReadOnlyCollection<ToothSelection> requested)
    {
        // A line that names no teeth is not tooth-specific; nothing to check.
        if (lineTeeth.Count == 0)
        {
            return;
        }

        EnsurePickedAmong(lineTeeth, requested);

        var covered = CoveredTeeth(lineTeeth, lineStages);
        if (requested.Any(t => covered.Contains(t.ToothCode)))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageToothAlreadyStaged,
                "One of those teeth already has a công đoạn on this line.");
        }
    }

    /// <summary>
    /// "Tạo bảo hành" off <paramref name="source"/>: a finished, live công đoạn of
    /// the same line, inside the service's warranty period, with no other
    /// warranty of the line still open, and teeth taken among the root's.
    /// </summary>
    /// <param name="root">The ordinary công đoạn the warranty descends from; null
    /// when it is not known (a warranty written before roots were recorded), in
    /// which case the line's own teeth bound the pick, as the reference does.</param>
    public void EnsureWarranty(
        TreatmentStage source,
        TreatmentStage? root,
        IReadOnlyCollection<ToothSelection> lineTeeth,
        IReadOnlyCollection<TreatmentStage> lineStages,
        IReadOnlyCollection<ToothSelection> requested,
        int warrantyDays,
        DateTimeOffset now)
    {
        if (source.IsSuperseded || source.Status != TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantySourceInvalid,
                "A warranty is raised from a finished công đoạn.");
        }

        if (warrantyDays <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasNoWarranty,
                "This service carries no warranty.");
        }

        if (WarrantyDaysLeft(warrantyDays, source.CreationTime, now) <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyExpired,
                "The warranty period is over.");
        }

        if (HasOpenWarranty(lineStages))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.OpenWarrantyMustComplete,
                "Another warranty of this line is still open.");
        }

        var allowed = root is { Teeth.Count: > 0 } ? root.Teeth : lineTeeth;
        if (allowed.Count > 0)
        {
            EnsurePickedAmong(allowed, requested);
        }
    }

    /// <summary>
    /// The reference's <c>hasOpenWarrantyStageForService</c>: a warranty công
    /// đoạn of the line that is neither superseded nor finished.
    /// </summary>
    public bool HasOpenWarranty(IEnumerable<TreatmentStage> lineStages) =>
        lineStages.Any(s =>
            s.IsGuarantee && !s.IsSuperseded && s.Status != TreatmentStageStatus.Completed);

    /// <summary>
    /// The reference's <c>getWarrantyDaysRemaining</c>: the period less the whole
    /// days since the công đoạn was worked, counted calendar day to calendar day.
    /// </summary>
    public static int WarrantyDaysLeft(int warrantyDays, DateTime workedAt, DateTimeOffset now) =>
        warrantyDays - (now.Date - workedAt.Date).Days;

    private static void EnsurePickedAmong(
        IReadOnlyCollection<ToothSelection> allowed,
        IReadOnlyCollection<ToothSelection> requested)
    {
        if (requested.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageTeethRequired,
                "Pick at least one tooth.");
        }

        var codes = allowed.Select(t => t.ToothCode).ToHashSet();
        if (requested.Any(t => !codes.Contains(t.ToothCode)))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageToothOutsideService,
                "That tooth is not part of this service line.");
        }
    }
}
