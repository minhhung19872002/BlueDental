namespace BlueDental.PatientManagement;

/// <summary>
/// Người giám hộ — limits shared by the domain, the DTOs and the EF mapping.
/// BA spec 2026-10-07: a patient under <see cref="RequiredUnderAge"/> needs at
/// least one guardian, at most <see cref="MaxPerPatient"/>, exactly one of them
/// the primary contact.
/// </summary>
public static class PatientGuardianConsts
{
    public const int MaxPerPatient = 3;

    /// <summary>Age as "năm hiện tại − năm sinh"; below this a guardian is required.</summary>
    public const int RequiredUnderAge = 16;

    public const int MaxFullNameLength = 200;
    public const int MaxPhoneLength = 20;
    public const int MaxNationalIdLength = 20;
    public const int MaxIdIssuedPlaceLength = 200;
    public const int MaxEmailLength = 256;
    public const int MaxAddressLength = 500;
    public const int MaxRelationNoteLength = 200;
    public const int MaxProofBlobNameLength = 300;
    public const int MaxProofFileNameLength = 255;

    /// <summary>Giấy tờ chứng minh quyền giám hộ — JPG, PNG or PDF, at most 5 MB.</summary>
    public const long MaxProofFileBytes = 5 * 1024 * 1024;
}

/// <summary>Quan hệ với khách hàng — the fixed pills of the guardian form.</summary>
public enum GuardianRelation : short
{
    Father = 1,
    Mother = 2,
    Grandfather = 3,
    Grandmother = 4,
    Sibling = 5,
    AuntUncle = 6,
    LegalGuardian = 7,
    Other = 8
}

/// <summary>Giấy tờ chứng minh quyền giám hộ — asked for when the relation is "Khác".</summary>
public enum GuardianProofType : short
{
    PowerOfAttorney = 1,
    GuardianshipDecision = 2,
    BirthCertificate = 3,
    Other = 4
}
