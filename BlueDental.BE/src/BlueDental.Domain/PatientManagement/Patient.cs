using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.PatientManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// Aggregate root for the Patient bounded context.
/// Encapsulates patient demographics, dental chart, and medical history.
/// </summary>
public class Patient : FullAuditedAggregateRoot<Guid>
{
    private readonly List<Guid> _tagIds = new();
    private readonly List<Guid> _diseaseHistoryEntryIds = new();

    public string PatientCode { get; private set; } = default!;
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;

    /// <summary>Vietnamese order — họ first, then tên, as every screen shows it.</summary>
    public string FullName => $"{LastName} {FirstName}".Trim();

    /// <summary>
    /// Optional: the reference's "Tạo hồ sơ" form does not require a birth date,
    /// and rows registered at the front desk regularly have none.
    /// </summary>
    public DateOnly? DateOfBirth { get; private set; }

    public Gender Gender { get; private set; }
    public ContactInfo Contact { get; private set; } = default!;
    public string? NationalId { get; private set; }
    public string? BloodType { get; private set; }
    public string? MedicalAlerts { get; private set; }
    public PatientStatus Status { get; private set; }
    public Guid BranchId { get; private set; }
    public DateTimeOffset RegisteredAt { get; private set; }

    // ── The rest of what the hồ sơ dialog collects ───────────────────────────

    /// <summary>Chọn loại nguồn đến — a group of the Nguồn đến catalog.</summary>
    public Guid? SourceTaxonomyId { get; private set; }

    /// <summary>Kênh kết nối — an entry inside that group.</summary>
    public Guid? SourceEntryId { get; private set; }

    /// <summary>Nghề nghiệp — an entry of the Nghề nghiệp catalog.</summary>
    public Guid? OccupationEntryId { get; private set; }

    /// <summary>Free text used when the occupation picker's Khác box is ticked.</summary>
    public string? OccupationOther { get; private set; }

    /// <summary>Số thẻ BHYT.</summary>
    public string? InsuranceNumber { get; private set; }

    /// <summary>Tỉnh/ Thành phố — code from the shared province list.</summary>
    public string? ProvinceCode { get; private set; }

    /// <summary>Xã/ Phường — code from that province's ward list.</summary>
    public string? WardCode { get; private set; }

    /// <summary>Lý do đến khám.</summary>
    public string? ExaminationReason { get; private set; }

    /// <summary>Ghi chú.</summary>
    public string? Note { get; private set; }

    /// <summary>Thẻ hồ sơ — ids from the branch's PatientTag catalog.</summary>
    public IReadOnlyCollection<Guid> TagIds => _tagIds.AsReadOnly();

    /// <summary>Tiểu sử bệnh — entry ids from the Lịch sử bệnh catalog.</summary>
    public IReadOnlyCollection<Guid> DiseaseHistoryEntryIds => _diseaseHistoryEntryIds.AsReadOnly();

    protected Patient() { }

    /// <summary>
    /// Factory method to register a new patient.
    /// </summary>
    public static Patient Register(
        Guid id,
        string patientCode,
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        Gender gender,
        ContactInfo contact,
        Guid branchId,
        string? nationalId = null)
    {
        Check.NotNullOrWhiteSpace(patientCode, nameof(patientCode));
        // Only the family name is required: the dialog collects one "Họ và tên"
        // and a single-word name is a whole name, not half of one.
        Check.NotNullOrWhiteSpace(lastName, nameof(lastName));
        GuardDateOfBirth(dateOfBirth);

        return new Patient
        {
            Id = id,
            PatientCode = patientCode,
            FirstName = firstName,
            LastName = lastName,
            DateOfBirth = dateOfBirth,
            Gender = gender,
            Contact = contact,
            BranchId = branchId,
            NationalId = nationalId,
            Status = PatientStatus.Active,
            RegisteredAt = DateTimeOffset.UtcNow
        };
    }

    public Patient UpdateDemographics(
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        Gender gender)
    {
        Check.NotNullOrWhiteSpace(lastName, nameof(lastName));
        GuardDateOfBirth(dateOfBirth);

        FirstName = firstName;
        LastName = lastName;
        DateOfBirth = dateOfBirth;
        Gender = gender;
        return this;
    }

    public Patient UpdateContact(ContactInfo contact)
    {
        Contact = contact;
        return this;
    }

    public Patient UpdateMedicalInfo(string? bloodType, string? medicalAlerts)
    {
        BloodType = bloodType;
        MedicalAlerts = medicalAlerts;
        return this;
    }

    /// <summary>
    /// The record's own code. The reference lets the front desk overwrite the
    /// numeric half of the suggested code, so it is not frozen at registration.
    /// </summary>
    public Patient SetPatientCode(string patientCode)
    {
        Check.NotNullOrWhiteSpace(patientCode, nameof(patientCode));
        PatientCode = patientCode;
        return this;
    }

    /// <summary>Where the patient came from: a source group and its channel.</summary>
    public Patient SetSource(Guid? sourceTaxonomyId, Guid? sourceEntryId)
    {
        // A channel without its group is meaningless — the dialog disables the
        // channel picker until a group is chosen, and the record keeps that rule.
        SourceTaxonomyId = sourceTaxonomyId;
        SourceEntryId = sourceTaxonomyId.HasValue ? sourceEntryId : null;
        return this;
    }

    /// <summary>Nghề nghiệp: a catalog entry, or free text behind the Khác tick.</summary>
    public Patient SetOccupation(Guid? occupationEntryId, string? occupationOther)
    {
        OccupationEntryId = occupationEntryId;
        OccupationOther = Trimmed(occupationOther);
        return this;
    }

    public Patient SetInsuranceNumber(string? insuranceNumber)
    {
        InsuranceNumber = Trimmed(insuranceNumber);
        return this;
    }

    /// <summary>Codes only — a renamed province must not leave stale text on the row.</summary>
    public Patient SetResidence(string? provinceCode, string? wardCode)
    {
        ProvinceCode = Trimmed(provinceCode);
        WardCode = ProvinceCode is null ? null : Trimmed(wardCode);
        return this;
    }

    public Patient SetNotes(string? examinationReason, string? note)
    {
        ExaminationReason = Trimmed(examinationReason);
        Note = Trimmed(note);
        return this;
    }

    /// <summary>Replaces the tag set whole — the form edits it as one picker.</summary>
    public Patient SetTags(IEnumerable<Guid> tagIds)
    {
        _tagIds.Clear();
        _tagIds.AddRange(tagIds.Distinct());
        return this;
    }

    /// <summary>Replaces the ticked Tiểu sử bệnh boxes whole.</summary>
    public Patient SetDiseaseHistory(IEnumerable<Guid> entryIds)
    {
        _diseaseHistoryEntryIds.Clear();
        _diseaseHistoryEntryIds.AddRange(entryIds.Distinct());
        return this;
    }

    public Patient Deactivate()
    {
        Status = PatientStatus.Inactive;
        return this;
    }

    public Patient Transfer(Guid newBranchId)
    {
        BranchId = newBranchId;
        Status = PatientStatus.Transferred;
        return this;
    }

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void GuardDateOfBirth(DateOnly? dateOfBirth)
    {
        if (dateOfBirth.HasValue && dateOfBirth.Value > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidDateOfBirth,
                "Date of birth cannot be in the future.");
        }
    }
}
