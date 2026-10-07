using System;
using System.Collections.Generic;

namespace BlueDental.PatientManagement;

/// <summary>Where a "Tìm người giám hộ" match was found.</summary>
public enum GuardianCandidateSource
{
    /// <summary>A hồ sơ khách hàng / bệnh nhân.</summary>
    Patient = 1,

    /// <summary>Somebody already declared as người giám hộ for another patient, without a hồ sơ.</summary>
    Guardian = 2
}

/// <summary>
/// One person the guardian popup's search box offers to copy into the form
/// (BA 2026-10-07): a hồ sơ, or a guardian already on file for another patient
/// — one phone, one person, typed once.
/// </summary>
public class GuardianCandidateDto
{
    public GuardianCandidateSource Source { get; set; }

    /// <summary>
    /// The hồ sơ the copied guardian links to: the match itself for
    /// <see cref="GuardianCandidateSource.Patient"/>, the guardian's own link (if
    /// any) otherwise.
    /// </summary>
    public Guid? PatientId { get; set; }

    /// <summary>Mã hồ sơ — only for <see cref="GuardianCandidateSource.Patient"/>.</summary>
    public string? PatientCode { get; set; }

    public string FullName { get; set; } = default!;
    public string? Phone { get; set; }
    public string? NationalId { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public DateOnly? IdIssuedOn { get; set; }
    public string? IdIssuedPlace { get; set; }
    public Gender? Gender { get; set; }
    public string? Email { get; set; }
    public Guid? OccupationEntryId { get; set; }

    /// <summary>For a guardian: the patients they already answer for, newest first.</summary>
    public List<GuardianWardDto> Wards { get; set; } = [];
}

/// <summary>A patient a matched guardian already answers for.</summary>
public class GuardianWardDto
{
    public Guid PatientId { get; set; }
    public string PatientCode { get; set; } = default!;
    public string FullName { get; set; } = default!;
}

public class GetGuardianCandidatesInput
{
    /// <summary>Phone, CCCD or name, as typed.</summary>
    public string? Filter { get; set; }

    /// <summary>The hồ sơ being edited: never its own guardian, nor its group's.</summary>
    public Guid? ExcludePatientId { get; set; }
}
