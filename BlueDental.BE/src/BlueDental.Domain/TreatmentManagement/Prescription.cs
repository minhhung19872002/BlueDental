using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Đơn thuốc — one prescription slip with the medicines on it.
///
/// The reference lists prescriptions per patient with the columns
/// "Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám, Ngày tạo", so a slip carries a
/// code, a prescribing dentist, the diagnosis it answers and a follow-up date —
/// the medicines themselves are its lines. Templates come from the
/// "Đơn thuốc mẫu" catalog.
/// </summary>
public class Prescription : FullAuditedAggregateRoot<Guid>
{
    private readonly List<PrescriptionItem> _items = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Slip number shown in the UI.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Prescribing dentist.</summary>
    public Guid StaffId { get; private set; }

    /// <summary>The diagnosis record this answers, when it came from one.</summary>
    public Guid? PatientDiagnosisId { get; private set; }

    /// <summary>Free-text diagnosis shown on the slip.</summary>
    public string? DiagnosisText { get; private set; }

    /// <summary>Tái khám — when the patient should come back.</summary>
    public DateOnly? FollowUpDate { get; private set; }

    public string? Note { get; private set; }

    public PrescriptionStatus Status { get; private set; }

    public DateTimeOffset IssuedAt { get; private set; }

    public IReadOnlyCollection<PrescriptionItem> Items => _items.AsReadOnly();

    protected Prescription() { }

    public static Prescription Issue(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string code,
        Guid staffId,
        IEnumerable<PrescriptionItem> items,
        Guid? patientDiagnosisId = null,
        string? diagnosisText = null,
        DateOnly? followUpDate = null,
        string? note = null,
        DateTimeOffset? issuedAt = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        var lines = items?.ToList() ?? new List<PrescriptionItem>();
        if (lines.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                "A prescription needs at least one medicine.");
        }

        GuardNoDuplicateMedication(lines);

        var prescription = new Prescription
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Code = code,
            StaffId = staffId,
            PatientDiagnosisId = patientDiagnosisId,
            DiagnosisText = diagnosisText,
            FollowUpDate = followUpDate,
            Note = note,
            Status = PrescriptionStatus.Active,
            IssuedAt = issuedAt ?? DateTimeOffset.UtcNow
        };

        prescription._items.AddRange(lines);
        return prescription;
    }

    public Prescription UpdateDetails(
        Guid staffId,
        string? diagnosisText,
        DateOnly? followUpDate,
        string? note,
        IEnumerable<PrescriptionItem> items)
    {
        GuardEditable();

        var lines = items?.ToList() ?? new List<PrescriptionItem>();
        if (lines.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                "A prescription needs at least one medicine.");
        }

        GuardNoDuplicateMedication(lines);

        StaffId = staffId;
        DiagnosisText = diagnosisText;
        FollowUpDate = followUpDate;
        Note = note;

        _items.Clear();
        _items.AddRange(lines);
        return this;
    }

    /// <summary>Handed to the patient — the slip is frozen from here on.</summary>
    public Prescription Dispense()
    {
        GuardEditable();
        Status = PrescriptionStatus.Dispensed;
        return this;
    }

    public Prescription Cancel()
    {
        if (Status == PrescriptionStatus.Dispensed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                "A dispensed prescription cannot be cancelled.");
        }

        Status = PrescriptionStatus.Cancelled;
        return this;
    }

    private void GuardEditable()
    {
        if (Status is PrescriptionStatus.Dispensed or PrescriptionStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"A prescription in status {Status} can no longer be edited.");
        }
    }

    private static void GuardNoDuplicateMedication(IReadOnlyCollection<PrescriptionItem> items)
    {
        var duplicate = items
            .GroupBy(i => i.MedicationId)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate != null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                "The same medicine is listed more than once.");
        }
    }
}

/// <summary>One medicine on a prescription.</summary>
public class PrescriptionItem : Entity<Guid>
{
    public Guid PrescriptionId { get; private set; }

    /// <summary>Catalog entry of the "Loại thuốc" group.</summary>
    public Guid MedicationId { get; private set; }

    /// <summary>Name as it stood when prescribed; the catalog may change later.</summary>
    public string MedicationName { get; private set; } = string.Empty;

    /// <summary>Liều dùng, e.g. "1 viên".</summary>
    public string Dosage { get; private set; } = string.Empty;

    /// <summary>Tần suất, e.g. "2 lần/ngày".</summary>
    public string Frequency { get; private set; } = string.Empty;

    public int DurationDays { get; private set; }

    public int Quantity { get; private set; }

    public string? Instructions { get; private set; }

    protected PrescriptionItem() { }

    public PrescriptionItem(
        Guid id,
        Guid medicationId,
        string medicationName,
        string dosage,
        string frequency,
        int durationDays,
        int quantity,
        string? instructions = null)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(medicationName, nameof(medicationName));

        if (durationDays < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseQuantity,
                "A medicine is taken for at least one day.");
        }

        if (quantity < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseQuantity,
                "A medicine line needs at least one unit.");
        }

        MedicationId = medicationId;
        MedicationName = medicationName.Trim();
        Dosage = dosage;
        Frequency = frequency;
        DurationDays = durationDays;
        Quantity = quantity;
        Instructions = instructions;
    }
}
