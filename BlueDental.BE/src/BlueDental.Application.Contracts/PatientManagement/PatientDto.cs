using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

public class PatientDto : FullAuditedEntityDto<Guid>
{
    public string PatientCode { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }
    public PatientStatus Status { get; set; }
    public Guid BranchId { get; set; }
}

public class RegisterPatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }
}

public class UpdatePatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class GetPatientListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public PatientStatus? Status { get; set; }
    public Guid? BranchId { get; set; }
}
