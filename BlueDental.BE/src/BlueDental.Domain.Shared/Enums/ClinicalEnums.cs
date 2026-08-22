namespace BlueDental.TreatmentManagement;

/// <summary>
/// Lifecycle of a diagnosis recorded against a patient (Chẩn đoán của bệnh nhân).
/// Mirrors the reference application's <c>patient-diagnoses.status</c>.
/// </summary>
public enum PatientDiagnosisStatus
{
    Created = 1,
    InProgress = 2,
    Treated = 3,
    Cancelled = 4
}

/// <summary>
/// Lifecycle of a consulting line item (Tư vấn) offered to a patient.
/// Mirrors the reference application's <c>patient-advises.status</c>.
/// </summary>
public enum PatientAdviseStatus
{
    Created = 1,
    Accepted = 2,
    Converted = 3,
    Rejected = 4,
    Cancelled = 5
}

/// <summary>
/// How a discount value is interpreted.
/// Mirrors the reference application's <c>discountType</c> (<c>money</c> | <c>percentage</c>).
/// </summary>
public enum DiscountType
{
    None = 0,
    Money = 1,
    Percentage = 2
}

/// <summary>
/// Lifecycle of a service line inside a treatment plan (Dịch vụ điều trị).
/// Mirrors the reference application's <c>treatmentServices.status</c>.
/// </summary>
public enum TreatmentServiceStatus
{
    Created = 1,
    InProgress = 2,
    Done = 3,
    Cancelled = 4,
    Replaced = 5
}
