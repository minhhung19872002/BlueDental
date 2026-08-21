using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Organizations;

public class ClinicBranchDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public BranchStatus Status { get; set; }
}

public class CreateClinicBranchDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class UpdateClinicBranchDto
{
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
}

public class GetClinicBranchListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public BranchStatus? Status { get; set; }
}
