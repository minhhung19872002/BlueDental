using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

public class StaffDto : EntityDto<Guid>
{
    public string UserName { get; set; } = default!;
    public string? Name { get; set; }
    public string? Surname { get; set; }
    public string FullName => $"{Name} {Surname}".Trim();
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public List<string> RoleNames { get; set; } = [];

    /// <summary>Branches this staff member is limited to; empty means clinic-wide.</summary>
    public List<Guid> BranchIds { get; set; } = [];
}

public class GetStaffListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateStaffDto
{
    public string UserName { get; set; } = default!;
    public string Password { get; set; } = default!;
    public string? Name { get; set; }
    public string? Surname { get; set; }
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public List<string> RoleNames { get; set; } = [];

    /// <summary>Branches this staff member may work in; empty means clinic-wide.</summary>
    public List<Guid> BranchIds { get; set; } = [];
}

public class UpdateStaffDto
{
    public string? Name { get; set; }
    public string? Surname { get; set; }
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> RoleNames { get; set; } = [];
    public List<Guid> BranchIds { get; set; } = [];
}
