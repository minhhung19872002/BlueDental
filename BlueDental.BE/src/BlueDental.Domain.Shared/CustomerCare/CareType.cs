namespace BlueDental.CustomerCare;

/// <summary>
/// The care programmes the reference exposes as tabs on the CSKH screen:
/// Sau điều trị · Chúc mừng sinh nhật · Nhắc lịch hẹn · CSKH định kì · CSKH đặc biệt.
///
/// Wire values (staging, 2026-08-26): <c>afterTreatment</c>, <c>happyBirthday</c>,
/// <c>reminder</c>, <c>recurring</c>, <c>special</c>, plus <c>base</c> — the
/// "Tạo công việc mới" task created from the Phân nhóm CSKH tab.
/// Recorded in docs/clone/pages/cskh-grouping.md.
/// </summary>
public enum CareType : short
{
    /// <summary>Sau điều trị (<c>afterTreatment</c>).</summary>
    AfterTreatment = 1,

    /// <summary>Chúc mừng sinh nhật (<c>happyBirthday</c>).</summary>
    Birthday = 2,

    /// <summary>Nhắc lịch hẹn (<c>reminder</c>).</summary>
    AppointmentReminder = 3,

    /// <summary>CSKH định kì (<c>recurring</c>).</summary>
    Periodic = 4,

    /// <summary>CSKH đặc biệt (<c>special</c>).</summary>
    Special = 5,

    /// <summary>Chăm sóc cơ bản — công việc tạo từ tab Phân nhóm CSKH (<c>base</c>).</summary>
    Base = 6
}
