using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// Bộ hồ sơ bệnh án — one bundle of a patient's Bệnh án sheets, opened for one
/// or more treatment slips (phiếu điều trị).
///
/// The clinic's own design (save/P1710.drawio, 2026-10-17), not the reference's:
/// a patient may hold several sets, each numbered
/// <c>HS{patient code}-{DDMMYYYY}-{nn}</c>, each showing a chosen subset of the
/// nine forms in its index. A treatment slip sits in at most one live set.
///
/// A set is never removed — the sheets in it are part of the medical record.
/// Cancelling it keeps it, read-only, at the bottom of the list and lets its
/// slips go, so they can be put into another set.
/// </summary>
public class MedicalRecordSet : FullAuditedAggregateRoot<Guid>
{
    public const int MaxCodeLength = 64;

    /// <summary>The nine forms, in index order — what "show every form" means.</summary>
    public static readonly IReadOnlyList<MedicalRecordForm> AllForms = Enum.GetValues<MedicalRecordForm>();

    private readonly List<MedicalRecordSetPlan> _plans = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public MedicalRecordSetStatus Status { get; private set; }

    /// <summary>
    /// The xxxx of Số ngoại trú <c>NGT-{MMyy}{patient code}-{xxxx}</c>: the sets
    /// the branch had opened that clinic day, this one included. A running number
    /// is kept, not worked out; the MMyy is read when printed, from the day
    /// treatment started (save/P1810.drawio, owner 2026-10-19). 0 on none.
    /// </summary>
    public int OutpatientSequence { get; private set; }

    /// <summary>
    /// The forms left out of the index, one bit per form (bit n-1 for form n).
    /// Stored as what is hidden so that a set made before a tenth form existed
    /// would show it.
    /// </summary>
    public int HiddenFormMask { get; private set; }

    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledById { get; private set; }

    public IReadOnlyCollection<MedicalRecordSetPlan> Plans => _plans.AsReadOnly();

    public bool IsCancelled => Status == MedicalRecordSetStatus.Cancelled;

    /// <summary>The slips this set holds now — a cancelled set holds none.</summary>
    public IEnumerable<MedicalRecordSetPlan> HeldPlans => _plans.Where(plan => !plan.Released);

    public IReadOnlyList<MedicalRecordForm> VisibleForms =>
        AllForms.Where(form => (HiddenFormMask & BitOf(form)) == 0).ToList();

    protected MedicalRecordSet() { }

    public static MedicalRecordSet Open(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string code,
        IEnumerable<MedicalRecordForm> visibleForms,
        int outpatientSequence = 0)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code), MaxCodeLength);
        Check.Range(outpatientSequence, nameof(outpatientSequence), 0, 9999);

        var set = new MedicalRecordSet
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Code = code,
            OutpatientSequence = outpatientSequence,
            Status = MedicalRecordSetStatus.Active,
        };
        set.ShowOnly(visibleForms);
        return set;
    }

    /// <summary>"Mục hiển thị": every form stays in the set; an unticked one only leaves the index.</summary>
    public MedicalRecordSet ShowOnly(IEnumerable<MedicalRecordForm> forms)
    {
        EnsureActive();

        var shown = forms.Where(AllForms.Contains).ToHashSet();
        if (shown.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetNeedsForm);
        }

        HiddenFormMask = AllForms.Where(form => !shown.Contains(form)).Aggregate(0, (mask, form) => mask | BitOf(form));
        return this;
    }

    public bool Holds(Guid treatmentPlanId) => HeldPlans.Any(plan => plan.TreatmentPlanId == treatmentPlanId);

    /// <summary>
    /// Puts a slip into the set. Whether the slip may come — it is not cancelled,
    /// and has not started if it is leaving another set — is
    /// <see cref="MedicalRecordSetPlanRules"/>'s to say; the set only refuses
    /// once it is cancelled itself.
    /// </summary>
    public MedicalRecordSet Attach(Guid treatmentPlanId, Guid dentistId, DateTime attachedAt)
    {
        EnsureActive();
        if (Holds(treatmentPlanId)) return this;

        _plans.Add(new MedicalRecordSetPlan(Id, treatmentPlanId, dentistId, attachedAt));
        return this;
    }

    public MedicalRecordSet Detach(Guid treatmentPlanId)
    {
        EnsureActive();
        _plans.RemoveAll(plan => plan.TreatmentPlanId == treatmentPlanId);
        return this;
    }

    /// <summary>
    /// "Hủy bộ hồ sơ". The set stays, marked Đã hủy, and its slips are let go —
    /// they read "Chưa thêm vào bệnh án" again. The links are kept, released,
    /// so the cancelled set still says which slips it was opened for.
    /// </summary>
    public MedicalRecordSet Cancel(DateTime cancelledAt, Guid? cancelledById)
    {
        EnsureActive();

        Status = MedicalRecordSetStatus.Cancelled;
        CancelledAt = cancelledAt;
        CancelledById = cancelledById;
        foreach (var plan in _plans)
        {
            plan.Release();
        }

        return this;
    }

    public void EnsureActive()
    {
        if (IsCancelled)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetCancelled);
        }
    }

    /// <summary>
    /// The set's number: <c>HS{patient code}-{DDMMYYYY}-{nn}</c>, where nn counts
    /// the sets the patient opened that day, from 01.
    /// </summary>
    public static string CodeFor(string patientCode, DateOnly clinicDay, int sequence) =>
        $"{CodePrefixFor(patientCode, clinicDay)}{sequence:D2}";

    public static string CodePrefixFor(string patientCode, DateOnly clinicDay) =>
        $"HS{patientCode}-{clinicDay:ddMMyyyy}-";

    /// <summary>
    /// Số ngoại trú: <c>NGT-{MMyy}{patient code}-{xxxx}</c> — MMyy of the day
    /// treatment started (the oldest công đoạn of every slip in the set), and
    /// xxxx the set's <see cref="OutpatientSequence"/>.
    /// </summary>
    public static string OutpatientNumberFor(string patientCode, DateOnly treatmentStart, int sequence) =>
        $"NGT-{treatmentStart:MMyy}{patientCode}-{sequence:D4}";

    /// <summary>
    /// Mã lưu trữ (also "Số lưu trữ" and "Tờ điều trị số"):
    /// <c>NK-{MMyy}{patient code}{slip code}</c> — the month the set was opened
    /// and its oldest slip. NK-1026DH264444DT01.
    /// </summary>
    public static string StorageCodeFor(DateOnly openedOn, string patientCode, string firstPlanCode) =>
        $"NK-{openedOn:MMyy}{patientCode}{firstPlanCode}";

    private static int BitOf(MedicalRecordForm form) => 1 << ((int)form - 1);
}
