using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Catalogs;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Đơn thuốc — one prescription slip with the medicines on it.
///
/// Mirrors the reference "BE:Treatment:AddPrescription" dialog: the prescribing doctor, a
/// diagnosis (picked from the patient's phiếu điều trị since F-58, printed as
/// text), lời dặn, in-/outpatient, a follow-up date and one line per medicine
/// dosed by session (sáng / trưa / chiều / tối × số ngày, plus the
/// "BE:Field:Usage" flags). The list shows
/// "Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám, Ngày tạo" and offers Sửa / Xoá,
/// so a slip has no status of its own.
/// </summary>
public class Prescription : FullAuditedAggregateRoot<Guid>
{
    private readonly List<PrescriptionItem> _items = [];
    private readonly List<PrescriptionDiagnosis> _diagnoses = [];

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Slip number shown in the UI.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Prescribing doctor ("BE:Common:SelectDentist").</summary>
    public Guid StaffId { get; private set; }

    /// <summary>
    /// The diagnosis as printed on the slip. Since F-58 the dialog writes it from
    /// the picked <see cref="Diagnoses"/>; older slips hold free text.
    /// </summary>
    public string? DiagnosisText { get; private set; }

    /// <summary>"Ghi chú chẩn đoán" — filled from the source diagnosis notes, editable.</summary>
    public string? DiagnosisNote { get; private set; }

    /// <summary>"BE:Treatment:EnterAdvice".</summary>
    public string? Note { get; private set; }

    /// <summary>"BE:Common:Treatment" — ngoại trú / nội trú.</summary>
    public PrescriptionTreatmentType TreatmentType { get; private set; }

    /// <summary>Tái khám — when the patient should come back.</summary>
    public DateOnly? FollowUpDate { get; private set; }

    public DateTimeOffset IssuedAt { get; private set; }

    public IReadOnlyCollection<PrescriptionItem> Items => _items.AsReadOnly();

    /// <summary>The diagnoses picked from the patient's phiếu điều trị, as they stood then.</summary>
    public IReadOnlyCollection<PrescriptionDiagnosis> Diagnoses => _diagnoses.AsReadOnly();

    protected Prescription() { }

    public static Prescription Issue(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string code,
        Guid staffId,
        IEnumerable<PrescriptionItem> items,
        string? diagnosisText = null,
        string? note = null,
        PrescriptionTreatmentType treatmentType = PrescriptionTreatmentType.Outpatient,
        DateOnly? followUpDate = null,
        DateTimeOffset? issuedAt = null,
        IEnumerable<PrescriptionDiagnosis>? diagnoses = null,
        string? diagnosisNote = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        var prescription = new Prescription
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Code = code,
            IssuedAt = issuedAt ?? DateTimeOffset.UtcNow
        };

        prescription.SetDetails(staffId, diagnosisText, note, treatmentType, followUpDate);
        prescription.ReplaceItems(items);
        prescription.ReplaceDiagnoses(diagnoses, diagnosisNote);
        return prescription;
    }

    public Prescription UpdateDetails(
        Guid staffId,
        string? diagnosisText,
        string? note,
        PrescriptionTreatmentType treatmentType,
        DateOnly? followUpDate,
        IEnumerable<PrescriptionItem> items,
        IEnumerable<PrescriptionDiagnosis>? diagnoses = null,
        string? diagnosisNote = null)
    {
        // Lines are validated first so a bad line leaves the header untouched.
        ReplaceItems(items);
        ReplaceDiagnoses(diagnoses, diagnosisNote);
        SetDetails(staffId, diagnosisText, note, treatmentType, followUpDate);
        return this;
    }

    private void SetDetails(
        Guid staffId,
        string? diagnosisText,
        string? note,
        PrescriptionTreatmentType treatmentType,
        DateOnly? followUpDate)
    {
        if (staffId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "A prescription needs a prescribing doctor.");
        }

        if (!Enum.IsDefined(treatmentType))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                $"'{treatmentType}' is not a treatment type the reference offers.");
        }

        StaffId = staffId;
        DiagnosisText = Trimmed(diagnosisText);
        Note = Trimmed(note);
        TreatmentType = treatmentType;
        FollowUpDate = followUpDate;
    }

    private void ReplaceItems(IEnumerable<PrescriptionItem> items)
    {
        var lines = items?.ToList() ?? [];
        if (lines.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyPrescription,
                "A prescription needs at least one medicine.");
        }

        var duplicate = lines
            .GroupBy(i => i.MedicationId)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate != null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.DuplicatePrescriptionMedicine,
                "The same medicine is listed more than once.");
        }

        foreach (var line in lines)
        {
            line.AttachTo(Id);
        }

        _items.Clear();
        _items.AddRange(lines.OrderBy(l => l.SortOrder));
    }

    private void ReplaceDiagnoses(IEnumerable<PrescriptionDiagnosis>? diagnoses, string? diagnosisNote)
    {
        var picked = diagnoses?.ToList() ?? [];

        var duplicate = picked
            .GroupBy(d => (d.TreatmentPlanId, d.DiagnosisId))
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate != null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.DuplicatePrescriptionDiagnosis,
                "The same diagnosis of the same treatment plan is picked twice.");
        }

        foreach (var diagnosis in picked)
        {
            diagnosis.AttachTo(Id);
        }

        _diagnoses.Clear();
        _diagnoses.AddRange(picked.OrderBy(d => d.SortOrder));
        DiagnosisNote = Trimmed(diagnosisNote);
    }

    private static string? Trimmed(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

/// <summary>
/// One medicine on a prescription, dosed per session of the day (F-58: sáng /
/// trưa / chiều / tối replaced "ngày uống × mỗi lần"), plus the medicine name
/// as it stood when prescribed (the catalog may be renamed later). A
/// <see cref="PrescriptionTemplateLine"/> keeps the old shape; the dialog
/// spreads it over the sessions when a template is picked.
/// </summary>
public class PrescriptionItem : Entity<Guid>
{
    public Guid PrescriptionId { get; private set; }

    /// <summary>Catalog entry of the "BE:Common:MedicineType" group.</summary>
    public Guid MedicationId { get; private set; }

    public string MedicationName { get; private set; } = string.Empty;

    /// <summary>Sáng — amount in the morning (half a tablet is allowed, 0 = none).</summary>
    public decimal Morning { get; private set; }

    /// <summary>Trưa.</summary>
    public decimal Noon { get; private set; }

    /// <summary>Chiều.</summary>
    public decimal Afternoon { get; private set; }

    /// <summary>Tối.</summary>
    public decimal Evening { get; private set; }

    /// <summary>Số ngày.</summary>
    public int Days { get; private set; }

    /// <summary>Sử dụng — multi-select flags.</summary>
    public PrescriptionUsage Usage { get; private set; }

    /// <summary>What the user wrote for "BE:Common:Other"; only kept when that flag is set.</summary>
    public string? OtherUsage { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>Số lượng = (sáng + trưa + chiều + tối) × số ngày, shown disabled.</summary>
    public decimal Quantity => DailyAmount * Days;

    public decimal DailyAmount => Morning + Noon + Afternoon + Evening;

    protected PrescriptionItem() { }

    public PrescriptionItem(
        Guid id,
        Guid medicationId,
        string medicationName,
        decimal morning,
        decimal noon,
        decimal afternoon,
        decimal evening,
        int days,
        PrescriptionUsage usage,
        string? otherUsage,
        int sortOrder)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(medicationName, nameof(medicationName));

        if (medicationId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "A prescription line needs a medicine.");
        }

        if (morning < 0m || noon < 0m || afternoon < 0m || evening < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "A session amount cannot be negative.");
        }

        if (days <= 0 || morning + noon + afternoon + evening <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "A line needs at least one session above zero and a number of days above zero.");
        }

        var wantsOther = usage.HasFlag(PrescriptionUsage.Other);
        var trimmedOther = otherUsage?.Trim();

        if (wantsOther && string.IsNullOrEmpty(trimmedOther))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "\"Khác\" needs the text of the other usage.");
        }

        MedicationId = medicationId;
        MedicationName = medicationName.Trim();
        Morning = morning;
        Noon = noon;
        Afternoon = afternoon;
        Evening = evening;
        Days = days;
        Usage = usage;
        OtherUsage = wantsOther ? trimmedOther : null;
        SortOrder = sortOrder;
    }

    internal void AttachTo(Guid prescriptionId) => PrescriptionId = prescriptionId;
}

/// <summary>
/// One diagnosis picked from a phiếu điều trị of the patient (F-58). The plan
/// code, diagnosis name and teeth are snapshots, so the slip still reads right
/// after the phiếu is edited or cancelled.
/// </summary>
public class PrescriptionDiagnosis : Entity<Guid>
{
    public Guid PrescriptionId { get; private set; }

    public Guid TreatmentPlanId { get; private set; }

    /// <summary>Catalog entry of the Chẩn đoán group.</summary>
    public Guid DiagnosisId { get; private set; }

    /// <summary>Số phiếu điều trị, e.g. "DT03".</summary>
    public string PlanCode { get; private set; } = string.Empty;

    public string DiagnosisName { get; private set; } = string.Empty;

    /// <summary>FDI codes joined by commas ("36,37"), empty when the line has no tooth.</summary>
    public string ToothCodes { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    protected PrescriptionDiagnosis() { }

    public PrescriptionDiagnosis(
        Guid id,
        Guid treatmentPlanId,
        Guid diagnosisId,
        string planCode,
        string diagnosisName,
        IEnumerable<int> toothCodes,
        int sortOrder)
        : base(id)
    {
        if (treatmentPlanId == Guid.Empty || diagnosisId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionDiagnosisSourceInvalid,
                "A picked diagnosis needs its treatment plan and diagnosis.");
        }

        Check.NotNullOrWhiteSpace(diagnosisName, nameof(diagnosisName));

        TreatmentPlanId = treatmentPlanId;
        DiagnosisId = diagnosisId;
        PlanCode = planCode?.Trim() ?? string.Empty;
        DiagnosisName = diagnosisName.Trim();
        ToothCodes = string.Join(",", (toothCodes ?? []).Distinct().Order());
        SortOrder = sortOrder;
    }

    public IReadOnlyList<int> ToothCodeList() =>
        string.IsNullOrEmpty(ToothCodes)
            ? []
            : ToothCodes.Split(',').Select(int.Parse).ToList();

    internal void AttachTo(Guid prescriptionId) => PrescriptionId = prescriptionId;
}
