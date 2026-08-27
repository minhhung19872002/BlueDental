using System;
using System.Collections.Generic;
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

    /// <summary>Thẻ hồ sơ — ids from the branch's PatientTag catalog.</summary>
    public List<Guid> TagIds { get; set; } = new();
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
    public List<Guid>? TagIds { get; set; }
}

public class UpdatePatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }

    /// <summary>Null = keep the current tags; a list replaces them whole.</summary>
    public List<Guid>? TagIds { get; set; }
}

public class GetPatientListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public PatientStatus? Status { get; set; }

    /// <summary>Phân loại theo Tag — patients carrying this Thẻ hồ sơ.</summary>
    public Guid? TagId { get; set; }
}
