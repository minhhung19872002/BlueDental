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

public enum PrescriptionStatus
{
    Active = 1,
    Dispensed = 2,
    Expired = 3,
    Cancelled = 4
}
