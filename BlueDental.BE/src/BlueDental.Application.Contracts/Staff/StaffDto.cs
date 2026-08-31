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
    public DateTime CreationTime { get; set; }
    public List<string> RoleNames { get; set; } = [];

    /// <summary>Branches this staff member is limited to; empty means clinic-wide.</summary>
    public List<Guid> BranchIds { get; set; } = [];

    // --- Extended profile fields (stored as ExtraProperties on IdentityUser) ---

    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? DistrictId { get; set; }
    public string? WardId { get; set; }

    public bool IsDentist { get; set; }
    public bool IsAssistant { get; set; }
    public bool IsHygienist { get; set; }

    /// <summary>Morning shift start time in "HH:mm" format.</summary>
    public string? MorningStartTime { get; set; }

    /// <summary>Morning shift end time in "HH:mm" format.</summary>
    public string? MorningEndTime { get; set; }

    /// <summary>Afternoon shift start time in "HH:mm" format.</summary>
    public string? AfternoonStartTime { get; set; }

    /// <summary>Afternoon shift end time in "HH:mm" format.</summary>
    public string? AfternoonEndTime { get; set; }

    public string? AvatarUrl { get; set; }
}

public class GetStaffListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
    public Guid? BranchId { get; set; }
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

    // --- Extended profile fields ---

    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? DistrictId { get; set; }
    public string? WardId { get; set; }

    public bool IsDentist { get; set; }
    public bool IsAssistant { get; set; }
    public bool IsHygienist { get; set; }

    public string? MorningStartTime { get; set; }
    public string? MorningEndTime { get; set; }
    public string? AfternoonStartTime { get; set; }
    public string? AfternoonEndTime { get; set; }
}

public class AvatarResultDto
{
    public string Url { get; set; } = default!;
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

    // --- Extended profile fields ---

    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? DistrictId { get; set; }
    public string? WardId { get; set; }

    public bool IsDentist { get; set; }
    public bool IsAssistant { get; set; }
    public bool IsHygienist { get; set; }

    public string? MorningStartTime { get; set; }
    public string? MorningEndTime { get; set; }
    public string? AfternoonStartTime { get; set; }
    public string? AfternoonEndTime { get; set; }
}
