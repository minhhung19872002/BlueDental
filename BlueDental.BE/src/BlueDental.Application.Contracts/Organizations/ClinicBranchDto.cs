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

    /// <summary>
    /// Limits the list to the branches this account may actually work in — what
    /// the header's branch switcher offers. The full list stays available to the
    /// screens that administer branches.
    /// </summary>
    public bool AccessibleOnly { get; set; }
}
