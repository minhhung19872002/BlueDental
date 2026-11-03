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

/// <summary>
/// The two warranty cards of a service line (P3110): "Nha khoa", activated from
/// the slip's Bảo hành tab, and "Labo", activated on a Labo order's teeth. A
/// warranty công đoạn names the one it is worked under (REQ-F3).
/// </summary>
public enum WarrantyCardKind
{
    Dental = 1,
    Labo = 2,
}
