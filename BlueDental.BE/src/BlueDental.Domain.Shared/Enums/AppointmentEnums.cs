namespace BlueDental.Appointments;

public enum AppointmentStatus
{
    Requested = 1,
    Confirmed = 2,
    CheckedIn = 3,
    InProgress = 4,
    Completed = 5,
    Cancelled = 6,
    NoShow = 7
}

public enum AppointmentType
{
    Consultation = 1,
    Examination = 2,
    Cleaning = 3,
    Treatment = 4,
    FollowUp = 5,
    Emergency = 6,
    Orthodontic = 7
}

public enum CancellationReason
{
    PatientRequest = 1,
    DentistUnavailable = 2,
    EquipmentFailure = 3,
    EmergencyPriority = 4,
    PatientNoResponse = 5,
    Other = 6
}

public enum AppointmentOutcome
{
    EndTreatment = 1,
    FollowUp = 2,
    TransferDoctor = 3,
    Revisit = 4
}

/// <summary>How a recurring booking repeats ("Lặp lại lịch hẹn").</summary>
public enum RecurrenceFrequency
{
    Daily = 1,
    Weekly = 2,
    Monthly = 3
}

/// <summary>When a recurring booking stops: after a number of sessions or on a date.</summary>
public enum RecurrenceEnd
{
    AfterCount = 1,
    OnDate = 2
}

/// <summary>
/// What the session list of a recurring booking says about one session. Free
/// and Conflict describe a session not booked yet (the create preview); the
/// others describe one already on the book.
/// </summary>
public enum SeriesOccurrenceState
{
    /// <summary>Còn trống — the dentist is free then.</summary>
    Free = 1,
    /// <summary>Trùng lịch — the slot is taken; the series cannot be saved.</summary>
    Conflict = 2,
    /// <summary>Đã hẹn — on the book as it was planned.</summary>
    Booked = 3,
    /// <summary>Đổi giờ — moved to another time on its own day.</summary>
    TimeChanged = 4,
    /// <summary>Đã đổi lịch — moved to another day.</summary>
    Rescheduled = 5,
    /// <summary>Đã huỷ hẹn.</summary>
    Cancelled = 6,
    /// <summary>Kết thúc — the visit is over; it can no longer be edited or deleted.</summary>
    Finished = 7
}

/// <summary>Why a planned session of a recurring booking cannot be booked.</summary>
public enum SeriesConflictReason
{
    DentistBusy = 1,
    PatientBusy = 2,
    OutsideShift = 3,
    DentistOff = 4,
    InThePast = 5
}
