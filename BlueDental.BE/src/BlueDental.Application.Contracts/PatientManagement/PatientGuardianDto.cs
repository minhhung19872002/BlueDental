using System;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.PatientManagement;

/// <summary>One người giám hộ as the hồ sơ dialog's cards and popup read it.</summary>
public class PatientGuardianDto
{
    public Guid Id { get; set; }
    public Guid? LinkedPatientId { get; set; }
    public GuardianRelation Relation { get; set; }
    public string? RelationNote { get; set; }
    public GuardianProofType? ProofType { get; set; }

    /// <summary>The uploaded paper, if any; download it through the guardian's document endpoint.</summary>
    public string? ProofBlobName { get; set; }

    public string? ProofFileName { get; set; }
    public string FullName { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string NationalId { get; set; } = default!;
    public DateOnly? DateOfBirth { get; set; }
    public DateOnly? IdIssuedOn { get; set; }
    public string? IdIssuedPlace { get; set; }
    public Gender? Gender { get; set; }
    public string? Email { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public bool SameAddressAsPatient { get; set; }
    public string? Address { get; set; }
    public bool IsPrimaryContact { get; set; }
    public DateTimeOffset ConsentedAt { get; set; }
}

/// <summary>
/// One guardian in a register / update payload. <see cref="Id"/> names a
/// guardian already on file (rewritten in place); without it a new one is added.
/// </summary>
public class PatientGuardianInput
{
    public Guid? Id { get; set; }

    /// <summary>Set when the popup filled the form from an existing hồ sơ.</summary>
    public Guid? LinkedPatientId { get; set; }

    public GuardianRelation Relation { get; set; }

    [StringLength(PatientGuardianConsts.MaxRelationNoteLength)]
    public string? RelationNote { get; set; }

    public GuardianProofType? ProofType { get; set; }

    /// <summary>What the guardian-document upload returned.</summary>
    [StringLength(PatientGuardianConsts.MaxProofBlobNameLength)]
    public string? ProofBlobName { get; set; }

    [StringLength(PatientGuardianConsts.MaxProofFileNameLength)]
    public string? ProofFileName { get; set; }

    [StringLength(PatientGuardianConsts.MaxFullNameLength)]
    public string FullName { get; set; } = default!;

    [StringLength(PatientGuardianConsts.MaxPhoneLength)]
    public string Phone { get; set; } = default!;

    [StringLength(PatientGuardianConsts.MaxNationalIdLength)]
    public string NationalId { get; set; } = default!;

    public DateOnly? DateOfBirth { get; set; }
    public DateOnly? IdIssuedOn { get; set; }

    [StringLength(PatientGuardianConsts.MaxIdIssuedPlaceLength)]
    public string? IdIssuedPlace { get; set; }

    public Gender? Gender { get; set; }

    [StringLength(PatientGuardianConsts.MaxEmailLength)]
    public string? Email { get; set; }

    public Guid? OccupationEntryId { get; set; }
    public bool SameAddressAsPatient { get; set; }

    [StringLength(PatientGuardianConsts.MaxAddressLength)]
    public string? Address { get; set; }

    public bool IsPrimaryContact { get; set; }
}

/// <summary>What the guardian-document upload hands back for the form to hold.</summary>
public class GuardianDocumentDto
{
    public string BlobName { get; set; } = default!;
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeInBytes { get; set; }
}
