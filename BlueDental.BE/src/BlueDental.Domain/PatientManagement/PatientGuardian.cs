using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.PatientManagement;

/// <summary>
/// Người giám hộ — one of up to three adults answering for a patient.
///
/// BA-driven (2026-10-07), not observed on the reference. Lives in its own
/// table keyed to the patient, but is written only through
/// <see cref="Patient.SetGuardians"/> so the group rules (at most three, one
/// primary contact, consent, the under-16 requirement) are checked together.
/// </summary>
public class PatientGuardian : Entity<Guid>
{
    /// <summary>The patient being answered for. Set by EF from the aggregate's collection.</summary>
    public Guid PatientId { get; private set; }

    /// <summary>
    /// The guardian's own hồ sơ, when the form was filled from "Tìm người giám
    /// hộ đã có hồ sơ". Optional: most parents are not patients themselves.
    /// </summary>
    public Guid? LinkedPatientId { get; private set; }

    public GuardianRelation Relation { get; private set; }

    /// <summary>"Ghi rõ quan hệ" — only kept for <see cref="GuardianRelation.Other"/>.</summary>
    public string? RelationNote { get; private set; }

    /// <summary>"Giấy tờ chứng minh quyền giám hộ" — only kept for <see cref="GuardianRelation.Other"/>.</summary>
    public GuardianProofType? ProofType { get; private set; }

    /// <summary>The scanned paper in blob storage; optional for now (BA 2026-10-07).</summary>
    public string? ProofBlobName { get; private set; }

    public string? ProofFileName { get; private set; }

    public string FullName { get; private set; } = default!;
    public string Phone { get; private set; } = default!;

    /// <summary>CCCD / Hộ chiếu.</summary>
    public string NationalId { get; private set; } = default!;

    public DateOnly? DateOfBirth { get; private set; }

    /// <summary>Ngày cấp CCCD.</summary>
    public DateOnly? IdIssuedOn { get; private set; }

    /// <summary>Nơi cấp.</summary>
    public string? IdIssuedPlace { get; private set; }

    public Gender? Gender { get; private set; }
    public string? Email { get; private set; }

    /// <summary>Nghề nghiệp — an entry of the branch's Nghề nghiệp catalog.</summary>
    public Guid? OccupationEntryId { get; private set; }

    /// <summary>"Cùng địa chỉ với khách hàng" — the patient's address stands in for this one.</summary>
    public bool SameAddressAsPatient { get; private set; }

    /// <summary>Only kept when <see cref="SameAddressAsPatient"/> is off.</summary>
    public string? Address { get; private set; }

    /// <summary>"Liên hệ chính" — exactly one per patient.</summary>
    public bool IsPrimaryContact { get; private set; }

    /// <summary>When the group confirmed the details and consented to treatment.</summary>
    public DateTimeOffset ConsentedAt { get; private set; }

    /// <summary>Order the cards and the accordion list them in.</summary>
    public int SortOrder { get; private set; }

    protected PatientGuardian() { }

    internal PatientGuardian(Guid id, PatientGuardianData data, int sortOrder, DateTimeOffset consentedAt)
        : base(id)
    {
        ConsentedAt = consentedAt;
        Apply(data, sortOrder);
    }

    internal void Apply(PatientGuardianData data, int sortOrder)
    {
        FullName = Required(data.FullName, PatientGuardianConsts.MaxFullNameLength);
        Phone = Required(data.Phone, PatientGuardianConsts.MaxPhoneLength);
        NationalId = Required(data.NationalId, PatientGuardianConsts.MaxNationalIdLength);

        Relation = data.Relation;
        var other = data.Relation == GuardianRelation.Other;
        RelationNote = other ? Optional(data.RelationNote, PatientGuardianConsts.MaxRelationNoteLength) : null;
        ProofType = other ? data.ProofType : null;
        ProofBlobName = other ? Optional(data.ProofBlobName, PatientGuardianConsts.MaxProofBlobNameLength) : null;
        ProofFileName = ProofBlobName is null
            ? null
            : Optional(data.ProofFileName, PatientGuardianConsts.MaxProofFileNameLength);

        if (other && (RelationNote is null || ProofType is null))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.GuardianOtherRelationIncomplete);
        }

        LinkedPatientId = data.LinkedPatientId;
        DateOfBirth = data.DateOfBirth;
        IdIssuedOn = data.IdIssuedOn;
        IdIssuedPlace = Optional(data.IdIssuedPlace, PatientGuardianConsts.MaxIdIssuedPlaceLength);
        Gender = data.Gender;
        Email = Optional(data.Email, PatientGuardianConsts.MaxEmailLength);
        OccupationEntryId = data.OccupationEntryId;
        SameAddressAsPatient = data.SameAddressAsPatient;
        Address = data.SameAddressAsPatient
            ? null
            : Optional(data.Address, PatientGuardianConsts.MaxAddressLength);
        IsPrimaryContact = data.IsPrimaryContact;
        SortOrder = sortOrder;
    }

    private static string Required(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.GuardianIncomplete);
        }

        return Check.Length(value.Trim(), nameof(value), maxLength)!;
    }

    private static string? Optional(string? value, int maxLength) =>
        string.IsNullOrWhiteSpace(value) ? null : Check.Length(value.Trim(), nameof(value), maxLength);
}

/// <summary>What the guardian form hands the aggregate; <see cref="Id"/> names a guardian already on file.</summary>
public sealed record PatientGuardianData(
    Guid? Id,
    Guid? LinkedPatientId,
    GuardianRelation Relation,
    string? RelationNote,
    GuardianProofType? ProofType,
    string? ProofBlobName,
    string? ProofFileName,
    string FullName,
    string Phone,
    string NationalId,
    DateOnly? DateOfBirth,
    DateOnly? IdIssuedOn,
    string? IdIssuedPlace,
    Gender? Gender,
    string? Email,
    Guid? OccupationEntryId,
    bool SameAddressAsPatient,
    string? Address,
    bool IsPrimaryContact);
