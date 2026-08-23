namespace BlueDental.CustomerCare;

/// <summary>
/// The care programmes the reference exposes as tabs on the CSKH screen:
/// Sau điều trị · Chúc mừng sinh nhật · Nhắc lịch hẹn · CSKH định kì · CSKH đặc biệt.
///
/// Only <c>afterTreatment</c> was observed on the wire; the rest are named after
/// their tabs. Recorded in docs/clone/business-features.md.
/// </summary>
public enum CareType : short
{
    /// <summary>Sau điều trị.</summary>
    AfterTreatment = 1,

    /// <summary>Chúc mừng sinh nhật.</summary>
    Birthday = 2,

    /// <summary>Nhắc lịch hẹn.</summary>
    AppointmentReminder = 3,

    /// <summary>CSKH định kì.</summary>
    Periodic = 4,

    /// <summary>CSKH đặc biệt.</summary>
    Special = 5
}
