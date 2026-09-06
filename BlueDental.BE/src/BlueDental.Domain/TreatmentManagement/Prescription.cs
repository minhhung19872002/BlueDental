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
/// Mirrors the reference "Thêm đơn thuốc" dialog: the prescribing doctor, a
/// free-text diagnosis, lời dặn, in-/outpatient, a follow-up date and one line
/// per medicine dosed the same way a "Đơn thuốc mẫu" template line is
/// (ngày uống × mỗi lần × số ngày, plus the "Sử dụng" flags). The list shows
/// "Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám, Ngày tạo" and offers Sửa / Xoá,
/// so a slip has no status of its own.
/// </summary>
public class Prescription : FullAuditedAggregateRoot<Guid>
{
    private readonly List<PrescriptionItem> _items = [];

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Slip number shown in the UI.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Prescribing doctor ("Chọn bác sĩ").</summary>
    public Guid StaffId { get; private set; }

    /// <summary>"Nhập chẩn đoán" — free text, not a catalog entry.</summary>
    public string? DiagnosisText { get; private set; }

    /// <summary>"Nhập lời dặn".</summary>
    public string? Note { get; private set; }

    /// <summary>"Điều trị" — ngoại trú / nội trú.</summary>
    public PrescriptionTreatmentType TreatmentType { get; private set; }

    /// <summary>Tái khám — when the patient should come back.</summary>
    public DateOnly? FollowUpDate { get; private set; }

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
        string? diagnosisText = null,
        string? note = null,
        PrescriptionTreatmentType treatmentType = PrescriptionTreatmentType.Outpatient,
        DateOnly? followUpDate = null,
        DateTimeOffset? issuedAt = null)
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
        return prescription;
    }

    public Prescription UpdateDetails(
        Guid staffId,
        string? diagnosisText,
        string? note,
        PrescriptionTreatmentType treatmentType,
        DateOnly? followUpDate,
        IEnumerable<PrescriptionItem> items)
    {
        // Lines are validated first so a bad line leaves the header untouched.
        ReplaceItems(items);
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

    private static string? Trimmed(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

/// <summary>
/// One medicine on a prescription — the same dosing shape as a
/// <see cref="PrescriptionTemplateLine"/>, plus the medicine name as it stood
/// when prescribed (the catalog may be renamed later).
/// </summary>
public class PrescriptionItem : Entity<Guid>
{
    public Guid PrescriptionId { get; private set; }

    /// <summary>Catalog entry of the "Loại thuốc" group.</summary>
    public Guid MedicationId { get; private set; }

    public string MedicationName { get; private set; } = string.Empty;

    /// <summary>Ngày uống — how many times a day.</summary>
    public int TimesPerDay { get; private set; }

    /// <summary>Mỗi lần — how much each time (half a tablet is allowed).</summary>
    public decimal AmountPerTime { get; private set; }

    /// <summary>Số ngày.</summary>
    public int Days { get; private set; }

    /// <summary>Sử dụng — multi-select flags.</summary>
    public PrescriptionUsage Usage { get; private set; }

    /// <summary>What the user wrote for "Khác"; only kept when that flag is set.</summary>
    public string? OtherUsage { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>Số lượng — the reference shows this box disabled and computes it.</summary>
    public decimal Quantity => TimesPerDay * AmountPerTime * Days;

    protected PrescriptionItem() { }

    public PrescriptionItem(
        Guid id,
        Guid medicationId,
        string medicationName,
        int timesPerDay,
        decimal amountPerTime,
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

        if (timesPerDay <= 0 || days <= 0 || amountPerTime <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine,
                "Times a day, amount per time and number of days must all be greater than zero.");
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
        TimesPerDay = timesPerDay;
        AmountPerTime = amountPerTime;
        Days = days;
        Usage = usage;
        OtherUsage = wantsOther ? trimmedOther : null;
        SortOrder = sortOrder;
    }

    internal void AttachTo(Guid prescriptionId) => PrescriptionId = prescriptionId;
}
