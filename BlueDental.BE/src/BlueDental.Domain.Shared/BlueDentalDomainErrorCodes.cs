namespace BlueDental;

public static class BlueDentalDomainErrorCodes
{
    public static class Organizations
    {
        public const string BranchNotFound = "BlueDental:Organizations:0001";
        public const string DuplicateCode = "BlueDental:Organizations:0002";
        public const string CannotDeleteActiveClinic = "BlueDental:Organizations:0003";
        public const string InvalidOperatingHours = "BlueDental:Organizations:0004";
    }

    public static class Catalogs
    {
        public const string ProcedureNotFound = "BlueDental:Catalogs:0001";
        public const string DuplicateProcedureCode = "BlueDental:Catalogs:0002";
        public const string InsurancePlanNotFound = "BlueDental:Catalogs:0003";
        public const string MedicationNotFound = "BlueDental:Catalogs:0004";
        public const string DuplicateMedicationCode = "BlueDental:Catalogs:0005";
    }

    public static class PatientManagement
    {
        public const string PatientNotFound = "BlueDental:Patient:0001";
        public const string DuplicatePatientCode = "BlueDental:Patient:0002";
        public const string InvalidContactInfo = "BlueDental:Patient:0003";
        public const string InvalidDateOfBirth = "BlueDental:Patient:0004";
        public const string PatientInactive = "BlueDental:Patient:0005";
    }

    public static class Appointments
    {
        public const string AppointmentNotFound = "BlueDental:Appointment:0001";
        public const string ConflictingSlot = "BlueDental:Appointment:0002";
        public const string InvalidTransition = "BlueDental:Appointment:0003";
        public const string CancellationReasonRequired = "BlueDental:Appointment:0004";
        public const string SlotInThePast = "BlueDental:Appointment:0005";
        public const string PatientAlreadyBooked = "BlueDental:Appointment:0006";
    }

    public static class TreatmentManagement
    {
        public const string TreatmentPlanNotFound = "BlueDental:Treatment:0001";
        public const string InvalidPlanTransition = "BlueDental:Treatment:0002";
        public const string PrescriptionNotFound = "BlueDental:Treatment:0003";
        public const string TreatmentRecordNotFound = "BlueDental:Treatment:0004";
        public const string NoActiveAppointment = "BlueDental:Treatment:0005";
    }

    public static class Billing
    {
        public const string InvoiceNotFound = "BlueDental:Billing:0001";
        public const string InvalidInvoiceTransition = "BlueDental:Billing:0002";
        public const string InvoiceAlreadyPaid = "BlueDental:Billing:0003";
        public const string InsufficientPaymentAmount = "BlueDental:Billing:0004";
        public const string InsuranceClaimNotFound = "BlueDental:Billing:0005";
        public const string InvalidCurrency = "BlueDental:Billing:0006";
        public const string NegativeAmount = "BlueDental:Billing:0007";
    }

    public static class Inventory
    {
        public const string ItemNotFound = "BlueDental:Inventory:0001";
        public const string InsufficientStock = "BlueDental:Inventory:0002";
        public const string DuplicateItemCode = "BlueDental:Inventory:0003";
        public const string InvalidStockMovement = "BlueDental:Inventory:0004";
    }

    public static class Notifications
    {
        public const string NotificationNotFound = "BlueDental:Notification:0001";
        public const string DeliveryFailed = "BlueDental:Notification:0002";
    }

    public static class Visits
    {
        public const string VisitNotFound = "BlueDental:Visit:0001";
        public const string InvalidTransition = "BlueDental:Visit:0002";
    }

    public static class Labo
    {
        public const string OrderNotFound = "BlueDental:Labo:0001";
        public const string InvalidTransition = "BlueDental:Labo:0002";
        public const string DuplicateOrderCode = "BlueDental:Labo:0003";
    }

    public static class CustomerCare
    {
        public const string RecordNotFound = "BlueDental:CustomerCare:0001";
        public const string InvalidTransition = "BlueDental:CustomerCare:0002";
    }
}
