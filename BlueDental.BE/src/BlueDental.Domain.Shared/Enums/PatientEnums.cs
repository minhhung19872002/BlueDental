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
