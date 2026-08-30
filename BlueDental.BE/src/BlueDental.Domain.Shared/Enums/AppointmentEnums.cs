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
