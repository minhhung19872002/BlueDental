using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.Staff;

namespace BlueDental.Timekeeping;

/// <summary>One month of the Lịch làm việc board (BA P0911, F-90) at the current branch.</summary>
public class WorkScheduleBoardDto
{
    public int Year { get; set; }

    public int Month { get; set; }

    /// <summary>The clinic's today: it and every day before it are locked.</summary>
    public DateOnly Today { get; set; }

    /// <summary>
    /// Most days off one person may register in a month at this branch, a half
    /// day counting 0.5 (BA 2026-11-14).
    /// </summary>
    public int MaxDayOffDays { get; set; }

    /// <summary>
    /// The caller is admin: sets <see cref="MaxDayOffDays"/> and is not held to it.
    /// </summary>
    public bool CanSetDayOffLimit { get; set; }

    public List<WorkScheduleGroupDto> Groups { get; set; } = [];
}

/// <summary>One unit of the org chart, or the "Chưa phân nhóm" group when <see cref="UnitId"/> is null.</summary>
public class WorkScheduleGroupDto
{
    public Guid? UnitId { get; set; }

    /// <summary>The unit's name; null for "Chưa phân nhóm", which the screen names.</summary>
    public string? Name { get; set; }

    public OrgUnitKind? Kind { get; set; }

    public Guid? HeadStaffId { get; set; }

    public List<WorkScheduleMemberDto> Members { get; set; } = [];
}

public class WorkScheduleMemberDto
{
    public Guid StaffId { get; set; }

    public string FullName { get; set; } = default!;

    /// <summary>Chức danh, else Vị trí.</summary>
    public string? RoleLabel { get; set; }

    public bool IsDentist { get; set; }

    /// <summary>Heads the group they are listed in.</summary>
    public bool IsHead { get; set; }

    public string? AvatarUrl { get; set; }

    /// <summary>Whether the caller may change this person's coming days.</summary>
    public bool CanEdit { get; set; }

    /// <summary>The month's registered days only; a day missing is "Chưa đăng ký".</summary>
    public List<WorkScheduleDayDto> Days { get; set; } = [];
}

public class WorkScheduleDayDto
{
    public DateOnly WorkDate { get; set; }

    public WorkScheduleShift Shift { get; set; }
}

public class GetWorkScheduleBoardInput
{
    [Range(2000, 2100)]
    public int Year { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }
}

/// <summary>"Lưu lịch": every changed cell at once; one refused cell refuses all.</summary>
public class SaveWorkScheduleInput
{
    [Required]
    [MinLength(1)]
    [MaxLength(5000)]
    public List<WorkScheduleItemInput> Items { get; set; } = [];
}

public class WorkScheduleItemInput
{
    public Guid StaffId { get; set; }

    public DateOnly WorkDate { get; set; }

    [EnumDataType(typeof(WorkScheduleShift))]
    public WorkScheduleShift Shift { get; set; }
}

public class SaveWorkScheduleResultDto
{
    /// <summary>Days written.</summary>
    public int Saved { get; set; }

    /// <summary>Late changes recorded in the change log.</summary>
    public int Logged { get; set; }
}

/// <summary>Admin's "Số ngày nghỉ tối đa" for the current branch.</summary>
public class SetDayOffLimitInput
{
    [Range(1, 31)]
    public int MaxDayOffDays { get; set; }
}

public class DayOffLimitDto
{
    public int MaxDayOffDays { get; set; }
}
