using System.Linq;
using BlueDental.TreatmentManagement;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>
/// Which treatment slips may join or leave a bộ hồ sơ.
///
/// The clinic's rule (save/P1710.drawio, owner 2026-10-17):
/// - a free slip may be added to a set;
/// - a slip still "chưa điều trị" may be taken out of its set again;
/// - a slip another live set holds joins no other set — it is taken out of
///   that set first, so moving is always the clinic's two explicit steps;
/// - once treatment has started on a slip in a set, it stays where it is;
/// - a cancelled slip joins nothing.
/// </summary>
public static class MedicalRecordSetPlanRules
{
    /// <summary>
    /// "Chưa điều trị" — the slip reads "Đã tạo" on Kế hoạch điều trị: not yet
    /// approved into progress, or in progress with no line started. The same
    /// reading the slip list makes (planTypes.ts, planPill).
    /// </summary>
    public static bool IsNotStarted(TreatmentPlan plan) =>
        plan.Status switch
        {
            TreatmentPlanStatus.Draft or TreatmentPlanStatus.PendingApproval or TreatmentPlanStatus.Approved => true,
            TreatmentPlanStatus.InProgress => plan.Services.All(service => service.Status == TreatmentServiceStatus.Created),
            _ => false,
        };

    /// <summary>
    /// A slip joining a set: it must be the patient's, not cancelled, and held by
    /// no other live set — in the create and the edit view alike.
    /// </summary>
    public static void EnsureCanJoin(TreatmentPlan plan, MedicalRecordSet target, MedicalRecordSet? holder)
    {
        if (plan.PatientId != target.PatientId || plan.Status == TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanUnavailable)
                .WithData("code", plan.Code);
        }

        if (holder is not null && holder.Id != target.Id)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanTaken)
                .WithData("code", plan.Code)
                .WithData("set", holder.Code);
        }
    }

    /// <summary>A slip leaving its set: only while it has not started.</summary>
    public static void EnsureCanLeave(TreatmentPlan plan)
    {
        if (!IsNotStarted(plan))
        {
            throw Locked(plan);
        }
    }

    private static BusinessException Locked(TreatmentPlan plan) =>
        new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanLocked)
            .WithData("code", plan.Code);
}
