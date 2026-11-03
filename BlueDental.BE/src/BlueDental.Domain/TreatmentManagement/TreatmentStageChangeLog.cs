using System;
using Volo.Abp.Domain.Entities;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Immutable record of one change to a công đoạn of Lịch sử điều trị. BA
/// 2026-11-02: every row may be edited, "nhưng mọi chỉnh sửa có ghi log" so an
/// admin can look back. Written next to the change, in the same unit of work,
/// and never edited — so a plain entity with its own timestamp, which also
/// outlives the công đoạn's own soft delete.
///
/// <see cref="Before"/> / <see cref="After"/> hold the text that changed: the
/// note or remark, the picture's link, or a short JSON picture of the row for
/// a full edit or a delete.
/// </summary>
public class TreatmentStageChangeLog : Entity<Guid>
{
    public Guid TreatmentStageId { get; private set; }
    public Guid TreatmentServiceId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }
    public TreatmentStageChangeAction Action { get; private set; }
    public string? Before { get; private set; }
    public string? After { get; private set; }

    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }
    public string? ActorUserName { get; private set; }
    public string? IpAddress { get; private set; }

    public DateTime OccurredAt { get; private set; }

    private TreatmentStageChangeLog()
    {
    }

    public static TreatmentStageChangeLog Record(
        Guid id,
        TreatmentStage stage,
        TreatmentStageChangeAction action,
        string? before,
        string? after,
        Guid? actorUserId,
        string? actorName,
        string? actorUserName,
        string? ipAddress,
        DateTime occurredAt) =>
        new()
        {
            Id = id,
            TreatmentStageId = stage.Id,
            TreatmentServiceId = stage.TreatmentServiceId,
            PatientId = stage.PatientId,
            ClinicBranchId = stage.ClinicBranchId,
            Action = action,
            Before = before,
            After = after,
            ActorUserId = actorUserId,
            ActorName = actorName,
            ActorUserName = actorUserName,
            IpAddress = ipAddress,
            OccurredAt = occurredAt,
        };
}
