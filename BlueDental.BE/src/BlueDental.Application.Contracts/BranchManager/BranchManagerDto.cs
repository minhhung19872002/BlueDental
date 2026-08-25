using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.BranchManager;

public class BranchManagerDto : EntityDto<Guid>
{
    public string UserName { get; set; } = default!;
    public string? Name { get; set; }
    public string FullName => Name?.Trim() ?? string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public List<string> RoleNames { get; set; } = [];
    public List<Guid> BranchIds { get; set; } = [];

    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? WardId { get; set; }
    public string? AvatarUrl { get; set; }
}

public class GetBranchManagerListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? BranchId { get; set; }
}

public class CreateBranchManagerDto
{
    public string Password { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PhoneNumber { get; set; } = default!;
    public List<Guid> BranchIds { get; set; } = [];
    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? WardId { get; set; }
}

public class UpdateBranchManagerDto
{
    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PhoneNumber { get; set; } = default!;
    public List<Guid> BranchIds { get; set; } = [];
    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? WardId { get; set; }
}
