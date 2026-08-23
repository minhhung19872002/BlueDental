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
        public const string UnknownTaxonomyGroup = "BlueDental:Catalogs:0006";
        public const string SystemTaxonomyLocked = "BlueDental:Catalogs:0007";
        public const string InvalidTaxonomyColor = "BlueDental:Catalogs:0008";
        public const string InvalidCatalogPrice = "BlueDental:Catalogs:0009";
        public const string PriceNotSupported = "BlueDental:Catalogs:0010";
        public const string ContentNotSupported = "BlueDental:Catalogs:0011";
        public const string TaxonomyNotFound = "BlueDental:Catalogs:0012";
        public const string CatalogEntryNotFound = "BlueDental:Catalogs:0013";
        public const string TaxonomyNotEmpty = "BlueDental:Catalogs:0014";
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
        public const string InvalidToothCode = "BlueDental:Treatment:0006";
        public const string EmptyToothSelection = "BlueDental:Treatment:0007";
        public const string DuplicateToothSelection = "BlueDental:Treatment:0008";
        public const string NegativePaymentAmount = "BlueDental:Treatment:0009";
        public const string InvalidDiagnosisTransition = "BlueDental:Treatment:0010";
        public const string InvalidAdviseTransition = "BlueDental:Treatment:0011";
        public const string InvalidAdviseQuantity = "BlueDental:Treatment:0012";
        public const string InvalidDiscount = "BlueDental:Treatment:0013";
        public const string PatientDiagnosisNotFound = "BlueDental:Treatment:0014";
        public const string PatientAdviseNotFound = "BlueDental:Treatment:0015";
        public const string AdviseGroupNotFound = "BlueDental:Treatment:0016";
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
        public const string InvalidPrice = "BlueDental:Inventory:0005";
        public const string InvalidExpiry = "BlueDental:Inventory:0006";
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

    public static class Operations
    {
        public const string ArticleNotFound = "BlueDental:Operations:0001";
        public const string EmptyArticleContent = "BlueDental:Operations:0002";
        public const string TaskNotFound = "BlueDental:Operations:0003";
        public const string InvalidTaskTransition = "BlueDental:Operations:0004";
    }

    public static class Promotions
    {
        public const string VoucherNotFound = "BlueDental:Promotions:0001";
        public const string InvalidDiscount = "BlueDental:Promotions:0002";
        public const string InvalidValidityWindow = "BlueDental:Promotions:0003";
        public const string InvalidUsageLimit = "BlueDental:Promotions:0004";
        public const string VoucherExpired = "BlueDental:Promotions:0005";
        public const string InvalidVoucherTransition = "BlueDental:Promotions:0006";
        public const string VoucherNotApplicable = "BlueDental:Promotions:0007";
        public const string VoucherLocked = "BlueDental:Promotions:0008";
        public const string DuplicateVoucherCode = "BlueDental:Promotions:0009";
    }

    public static class Finance
    {
        public const string InvalidAmount = "BlueDental:Finance:0001";
        public const string ApprovalNotApplicable = "BlueDental:Finance:0002";
        public const string AlreadyApproved = "BlueDental:Finance:0003";
        public const string VoucherLocked = "BlueDental:Finance:0004";
        public const string SystemCategoryLocked = "BlueDental:Finance:0005";
        public const string SameTransferHolding = "BlueDental:Finance:0006";
        public const string SalesEntryNotFound = "BlueDental:Finance:0007";
        public const string CategoryNotFound = "BlueDental:Finance:0008";
        public const string CashflowEntryNotFound = "BlueDental:Finance:0009";
    }

    public static class Timekeeping
    {
        public const string RecordNotFound = "BlueDental:Timekeeping:0001";
        public const string InvalidShiftWindow = "BlueDental:Timekeeping:0002";
        public const string CheckOutWithoutCheckIn = "BlueDental:Timekeeping:0003";
        public const string ShiftAlreadyCheckedIn = "BlueDental:Timekeeping:0004";
        public const string ShiftAlreadyCheckedOut = "BlueDental:Timekeeping:0005";
        public const string CheckInOnDayOff = "BlueDental:Timekeeping:0006";
        public const string RegistrationLocked = "BlueDental:Timekeeping:0007";
        public const string NoOpenShift = "BlueDental:Timekeeping:0008";
        public const string InvalidOvertime = "BlueDental:Timekeeping:0009";
        public const string DuplicateDayRecord = "BlueDental:Timekeeping:0010";
    }

    public static class CustomerCare
    {
        public const string RecordNotFound = "BlueDental:CustomerCare:0001";
        public const string InvalidTransition = "BlueDental:CustomerCare:0002";
        public const string InvalidSchedule = "BlueDental:CustomerCare:0003";
        public const string OutcomeRequired = "BlueDental:CustomerCare:0004";
    }
}
