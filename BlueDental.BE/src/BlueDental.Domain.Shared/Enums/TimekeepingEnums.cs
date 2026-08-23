namespace BlueDental.Timekeeping;

/// <summary>
/// What the staff member registered for a given working day.
/// Reference UI: the OFF / ON toggle on each staff card of "Lịch làm việc".
/// </summary>
public enum WorkRegistration
{
    /// <summary>Chưa đăng ký.</summary>
    NotRegistered = 0,

    /// <summary>Đăng kí làm.</summary>
    Working = 1,

    /// <summary>Đăng kí nghỉ.</summary>
    DayOff = 2
}

/// <summary>
/// Attendance outcome for a working day.
/// Reference KPI bar: Đang làm việc / Nghỉ ngang.
/// </summary>
public enum AttendanceStatus
{
    /// <summary>Chưa vào ca.</summary>
    NotStarted = 0,

    /// <summary>Đang làm việc — checked in and not yet checked out.</summary>
    Working = 1,

    /// <summary>Hoàn thành — every started shift was checked out.</summary>
    Completed = 2,

    /// <summary>Nghỉ ngang — checked in but the shift was never closed.</summary>
    Abandoned = 3,

    /// <summary>Nghỉ — registered a day off, or did not show up at all.</summary>
    OnLeave = 4
}

/// <summary>Which half of the working day a shift belongs to.</summary>
public enum WorkShiftKind
{
    Morning = 1,
    Afternoon = 2
}
