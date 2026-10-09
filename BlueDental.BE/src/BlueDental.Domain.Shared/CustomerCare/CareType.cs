namespace BlueDental.CustomerCare;

/// <summary>
/// The care programmes the reference exposes as tabs on the CSKH screen:
/// Sau điều trị · Chúc mừng sinh nhật · Nhắc lịch hẹn · CSKH định kì · CSKH đặc biệt.
///
/// Wire values (staging, 2026-08-26): <c>afterTreatment</c>, <c>happyBirthday</c>,
/// <c>reminder</c>, <c>recurring</c>, <c>special</c>, plus <c>base</c> — the
/// "BE:Perm:CreateTask" task created from the Phân nhóm CSKH tab.
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
    Base = 6,

    /// <summary>Không làm dịch vụ — bệnh nhân đã đến nhưng không phát sinh dịch vụ.</summary>
    NoService = 7,

    /// <summary>
    /// Đặt lịch không đến — the appointment time passed by more than five
    /// minutes and the patient never arrived (owner, 2026-10-05).
    /// </summary>
    MissedAppointment = 8,

    /// <summary>
    /// Lịch hẹn hủy — one task per cancelled appointment, to call the patient
    /// back (bug list #16, feature checklist 2.7).
    /// </summary>
    CancelledAppointment = 9,

    /// <summary>
    /// Complain — a customer complaint filed by hand, with how the responsible
    /// staff handled it (bug list #16, feature checklist 2.6).
    /// </summary>
    Complaint = 10,

    /// <summary>
    /// Hẹn lại - Chưa chốt ngày — the visit ended with "Đã hẹn tiếp" / "Hẹn tái
    /// khám" but no date was fixed; customer care calls back to fix one
    /// (owner, 2026-10-09).
    /// </summary>
    UndatedRebook = 11
}
