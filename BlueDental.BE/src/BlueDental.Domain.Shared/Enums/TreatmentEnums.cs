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
/// "BE:Common:Treatment" on the "BE:Treatment:AddPrescription" dialog: the reference offers exactly
/// "BE:Treatment:Outpatient" (default) and "BE:Treatment:Inpatient".
/// </summary>
public enum PrescriptionTreatmentType
{
    Outpatient = 1,
    Inpatient = 2
}
