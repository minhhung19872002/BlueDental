namespace BlueDental.TreatmentManagement;

public enum TreatmentPlanStatus
{
    Draft = 1,
    PendingApproval = 2,
    Approved = 3,
    InProgress = 4,
    Completed = 5,
    Cancelled = 6
}

/// <summary>
/// "Điều trị" on the "Thêm đơn thuốc" dialog: the reference offers exactly
/// "Điều trị ngoại trú" (default) and "Điều trị nội trú".
/// </summary>
public enum PrescriptionTreatmentType
{
    Outpatient = 1,
    Inpatient = 2
}
