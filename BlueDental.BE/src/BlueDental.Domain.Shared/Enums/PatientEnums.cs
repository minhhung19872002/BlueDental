namespace BlueDental.PatientManagement;

public enum PatientStatus
{
    Active = 1,
    Inactive = 2,
    Deceased = 3,
    Transferred = 4
}

public enum Gender
{
    Male = 1,
    Female = 2,
    Other = 3,
    PreferNotToSay = 4
}

/// <summary>
/// Trạng thái điều trị on the patient list. Always derived from the patient's
/// treatment slips and never stored — the reference recomputes it per payload,
/// so a stored copy would only be a second thing to keep in step.
/// </summary>
public enum PatientTreatmentStatus
{
    /// <summary>Chưa phát sinh — no treatment slip at all.</summary>
    None = 1,

    /// <summary>Chưa phát sinh — a slip exists but no service has started.</summary>
    Created = 2,

    /// <summary>Đang điều trị.</summary>
    InProgress = 3,

    /// <summary>Hoàn tất.</summary>
    Done = 4
}

/// <summary>
/// The four tabs above the patient list. "Tất cả" is the absence of a filter,
/// and "Chưa phát sinh" deliberately covers both quiet states.
/// </summary>
public enum PatientTreatmentFilter
{
    /// <summary>Chưa phát sinh — <see cref="PatientTreatmentStatus.None"/> or Created.</summary>
    Pending = 1,

    /// <summary>Đang điều trị.</summary>
    InTreatment = 2,

    /// <summary>Điều trị hoàn tất.</summary>
    Completed = 3
}

public enum AllergyType
{
    Medication = 1,
    Material = 2,
    Latex = 3,
    Anesthetic = 4,
    Other = 5
}

public enum ToothStatus
{
    Present = 1,
    Missing = 2,
    Extracted = 3,
    Implant = 4,
    Crown = 5,
    RootCanal = 6,
    Decayed = 7,
    Fractured = 8,
    Impacted = 9,
    Unerupted = 10
}
