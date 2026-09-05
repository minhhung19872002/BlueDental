namespace BlueDental.Appointments;

/// <summary>What was done to an appointment. One row of the change history.</summary>
public enum AppointmentChangeAction
{
    Created = 1,
    Updated = 2,
    StatusChanged = 3,
    Cancelled = 4,
    Deleted = 5
}

/// <summary>Where the change came from.</summary>
public enum AppointmentChangeSource
{
    Web = 1,
    Mobile = 2,
    Api = 3,
    Import = 4,
    System = 5,
    Ai = 6,
    Webhook = 7
}
