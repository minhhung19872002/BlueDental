using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

/// <summary>A staff member as the org chart draws them.</summary>
public class OrgStaffDto : EntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? UserName { get; set; }
    public string? Position { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsDentist { get; set; }
    public bool IsActive { get; set; }
}

public class OrgUnitDto : EntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public OrgUnitKind Kind { get; set; }
    public Guid? ParentId { get; set; }
    public Guid? HeadStaffId { get; set; }

    /// <summary>Everyone whose đơn vị chính is this unit, the head first.</summary>
    public List<OrgStaffDto> Members { get; set; } = [];
    public DateTime CreationTime { get; set; }
}

/// <summary>The whole chart in one read: every unit, and the active staff who sit in none.</summary>
public class OrgChartDto
{
    public List<OrgUnitDto> Units { get; set; } = [];
    public List<OrgStaffDto> Unassigned { get; set; } = [];
}

public class OrgUnitInputDto
{
    [Required]
    [StringLength(OrgUnitConsts.MaxNameLength)]
    public string Name { get; set; } = default!;

    /// <summary>Mã đơn vị. Left empty on create, the next free code of the kind is taken.</summary>
    [StringLength(OrgUnitConsts.MaxCodeLength)]
    public string? Code { get; set; }

    [Required]
    public Guid ParentId { get; set; }

    [Required]
    public Guid HeadStaffId { get; set; }

    /// <summary>The full member list; the head is added when missing. Anyone left out goes back to "Chưa thuộc đơn vị nào".</summary>
    public List<Guid> MemberStaffIds { get; set; } = [];
}

public class CreateOrgUnitDto : OrgUnitInputDto
{
    [Required]
    public OrgUnitKind Kind { get; set; }
}

public class UpdateOrgUnitDto : OrgUnitInputDto;

public class ChangeOrgRootHeadDto
{
    public Guid? HeadStaffId { get; set; }
}

/// <summary>"Phân vào đơn vị": staff from the unassigned strip into one unit.</summary>
public class AssignOrgUnitMembersDto
{
    [Required]
    public Guid OrgUnitId { get; set; }

    [Required]
    [MinLength(1)]
    public List<Guid> StaffIds { get; set; } = [];
}

public class OrgUnitCodeDto
{
    public string Code { get; set; } = default!;
}

public class OrgUnitFieldChangeDto
{
    public string Field { get; set; } = default!;
    public string? Before { get; set; }
    public string? After { get; set; }
}

public class OrgUnitChangeLogDto : EntityDto<Guid>
{
    public Guid OrgUnitId { get; set; }
    public string OrgUnitName { get; set; } = default!;
    public OrgUnitKind OrgUnitKind { get; set; }
    public OrgChartAction Action { get; set; }
    public List<OrgUnitFieldChangeDto> Changes { get; set; } = [];
    public Guid? ActorUserId { get; set; }
    public string? ActorName { get; set; }
    public DateTime OccurredAt { get; set; }
}

public class GetOrgChartHistoryInput : PagedResultRequestDto
{
    /// <summary>Matches the unit name or who made the change.</summary>
    [StringLength(100)]
    public string? Filter { get; set; }

    public OrgChartAction? Action { get; set; }
    public Guid? OrgUnitId { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}
