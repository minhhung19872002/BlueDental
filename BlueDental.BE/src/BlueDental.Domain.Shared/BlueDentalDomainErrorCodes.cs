namespace BlueDental;

public static class BlueDentalDomainErrorCodes
{
    public static class Authorization
    {
        public const string CrossBranchAccess = "BlueDental:Authorization:0001";
    }

    public static class Authentication
    {
        /// <summary>Cụm 11 mục 11: the account may only sign in from its branches' networks.</summary>
        public const string LoginIpNotAllowed = "BlueDental:Auth:LoginIpNotAllowed";

        /// <summary>Cụm 11 mục 13: outside the account's branches' "Giờ được phép sử dụng".</summary>
        public const string LoginOutsideHours = "BlueDental:Auth:LoginOutsideHours";
    }

    public static class Organizations
    {
        public const string BranchNotFound = "BlueDental:Organizations:0001";
        public const string DuplicateCode = "BlueDental:Organizations:0002";
        public const string CannotDeleteActiveClinic = "BlueDental:Organizations:0003";
        public const string InvalidOperatingHours = "BlueDental:Organizations:0004";
        public const string BranchNotAssigned = "BlueDental:Organizations:0005";
        public const string DuplicateName = "BlueDental:Organizations:0006";
        public const string InvalidIpRange = "BlueDental:Organizations:0007";
        public const string InvalidUsageHours = "BlueDental:Organizations:0008";
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
        public const string UnknownPaymentAccountKind = "BlueDental:Catalogs:0015";
        public const string InvalidQrImageFile = "BlueDental:Catalogs:0016";
        public const string UnsupportedQrImageType = "BlueDental:Catalogs:0017";
        public const string QrImageNotFound = "BlueDental:Catalogs:0018";
        public const string InvalidServiceDiscount = "BlueDental:Catalogs:0019";
        public const string InvalidWarrantyPeriod = "BlueDental:Catalogs:0020";
        public const string InvalidStageValue = "BlueDental:Catalogs:0021";
        public const string InvalidPrescriptionLine = "BlueDental:Catalogs:0022";
        public const string InvalidImportFile = "BlueDental:Catalogs:0023";
        public const string ImportNotSupported = "BlueDental:Catalogs:0024";
        public const string LaboSupplierNotInBranch = "BlueDental:Catalogs:0025";
        public const string InvalidComboItem = "BlueDental:Catalogs:0026";
        public const string ComboNeedsItems = "BlueDental:Catalogs:0027";
        public const string ComboComponentNotAllowed = "BlueDental:Catalogs:0028";
        public const string ComboNotSupported = "BlueDental:Catalogs:0029";
        /// <summary>Another group of the same catalog, in the same branch, already has this name.</summary>
        public const string DuplicateTaxonomyName = "BlueDental:Catalogs:0030";
        /// <summary>Another service of the same group already has this name — a deleted one counts.</summary>
        public const string DuplicateServiceName = "BlueDental:Catalogs:0031";
        /// <summary>The same rule for every other catalog's entries.</summary>
        public const string DuplicateEntryName = "BlueDental:Catalogs:0032";
        /// <summary>A treatment plan or a consultation still names the service, so it cannot be deleted.</summary>
        public const string ServiceInUse = "BlueDental:Catalogs:0033";
        /// <summary>The service is the only component of a live combo, so deleting it would empty the combo.</summary>
        public const string ServiceIsLastComboComponent = "BlueDental:Catalogs:0034";
    }

    public static class PatientManagement
    {
        public const string PatientNotFound = "BlueDental:Patient:0001";
        public const string DuplicatePatientCode = "BlueDental:Patient:0002";
        public const string InvalidContactInfo = "BlueDental:Patient:0003";
        public const string InvalidDateOfBirth = "BlueDental:Patient:0004";
        public const string PatientInactive = "BlueDental:Patient:0005";
        public const string InvalidImageFile = "BlueDental:Patient:0006";
        public const string UnsupportedImageType = "BlueDental:Patient:0007";
        public const string PatientImageNotFound = "BlueDental:Patient:0008";
        public const string InvalidImageOrdering = "BlueDental:Patient:0010";
        public const string MedicalRecordTooLarge = "BlueDental:Patient:0009";
        public const string InvalidNationalId = "BlueDental:Patient:0011";
        public const string DuplicateNationalId = "BlueDental:Patient:0012";
        public const string GuardianRequired = "BlueDental:Patient:0013";
        public const string TooManyGuardians = "BlueDental:Patient:0014";
        public const string GuardianPrimaryContactRequired = "BlueDental:Patient:0015";
        public const string GuardianConsentRequired = "BlueDental:Patient:0016";
        public const string GuardianOtherRelationIncomplete = "BlueDental:Patient:0017";
        public const string InvalidGuardianDocument = "BlueDental:Patient:0018";
        public const string GuardianIncomplete = "BlueDental:Patient:0019";

        /// <summary>The name holds something other than letters, digits, spaces and - . ' (see PersonName).</summary>
        public const string InvalidPatientName = "BlueDental:Patient:0020";

        /// <summary>Another record in the branch already holds this phone number (bug list item 29).</summary>
        public const string DuplicatePhone = "BlueDental:Patient:0021";

        /// <summary>
        /// A masked phone ("090****567", Cụm 11 mục 9) came back in an edit and
        /// matches no number the record knows, so it cannot stand for one.
        /// </summary>
        public const string MaskedPhoneUnresolved = "BlueDental:Patient:0022";
    }

    public static class Appointments
    {
        public const string AppointmentNotFound = "BlueDental:Appointment:0001";
        public const string ConflictingSlot = "BlueDental:Appointment:0002";
        public const string InvalidTransition = "BlueDental:Appointment:0003";
        public const string CancellationReasonRequired = "BlueDental:Appointment:0004";
        public const string SlotInThePast = "BlueDental:Appointment:0005";
        public const string PatientAlreadyBooked = "BlueDental:Appointment:0006";
        public const string NotTemporary = "BlueDental:Appointment:0007";

        /// <summary>The slot is not inside the dentist's shifts that day; the booking is refused.</summary>
        public const string OutsideWorkingHours = "BlueDental:Appointment:0008";

        /// <summary>The dentist is registered off that whole day; refused like <see cref="OutsideWorkingHours"/>.</summary>
        public const string DentistOffDuty = "BlueDental:Appointment:0009";

        /// <summary>
        /// A booking can only be received on its own day (bug list item 25). 0010
        /// is taken inline by <c>Appointment.UpdateTempPatientInfo</c>.
        /// </summary>
        public const string CheckInNotToday = "BlueDental:Appointment:0011";

        /// <summary>A session of a recurring booking is taken; none of the series is saved.</summary>
        public const string SeriesConflict = "BlueDental:Appointment:0012";

        /// <summary>A recurring booking may hold at most <c>AppointmentRecurrence.MaxSessions</c> sessions.</summary>
        public const string SeriesTooLong = "BlueDental:Appointment:0013";

        /// <summary>The repeat rule is malformed: interval, count or end date out of range.</summary>
        public const string InvalidRecurrence = "BlueDental:Appointment:0014";

        /// <summary>A finished session of a recurring booking can be neither edited nor deleted (BA).</summary>
        public const string SeriesSessionFinished = "BlueDental:Appointment:0015";
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
        public const string PatientQuoteNotFound = "BlueDental:Treatment:0026";
        public const string InvalidStageSequence = "BlueDental:Treatment:0017";
        public const string InvalidStageTransition = "BlueDental:Treatment:0018";
        // 0019 was StageImageRequired — an invented rule, removed once the
        // reference was seen to close a công đoạn with no image. Left unused
        // rather than recycled so old logs stay readable.
        public const string EmptyPrescription = "BlueDental:Treatment:0021";
        public const string DuplicatePrescriptionMedicine = "BlueDental:Treatment:0022";
        public const string InvalidPrescriptionLine = "BlueDental:Treatment:0023";
        public const string PrescriptionTemplateNameRequired = "BlueDental:Treatment:0024";

        /// <summary>A step ticked that the công đoạn does not cover.</summary>
        public const string UnknownStageServiceItem = "BlueDental:Treatment:0025";

        /// <summary>
        /// "Chuyển đổi dịch vụ" on a line that is finished, cancelled or already
        /// replaced. The reference words this itself — its
        /// `treatment.validation.convertNotAllowed`.
        /// </summary>
        public const string ServiceConvertNotAllowed = "BlueDental:Treatment:0027";

        /// <summary>
        /// "Chuyển đổi dịch vụ" on a line that already has a finished công đoạn:
        /// the work is done and paid against this service, so moving the line to
        /// another one would leave that công đoạn behind.
        /// </summary>
        public const string ServiceHasCompletedStage = "BlueDental:Treatment:0028";

        /// <summary>
        /// Cancelling or converting a line whose labo order is still with the labo.
        /// The reference's own wording (2026-09-24):
        /// "Dịch vụ có đơn labo chưa hoàn tất, không thể huỷ."
        /// </summary>
        public const string ServiceHasOpenLaboOrder = "BlueDental:Treatment:0029";
        /// <summary>A công đoạn asked for a tooth its service line does not treat.</summary>
        public const string StageToothOutsideService = "BlueDental:Treatment:0030";

        /// <summary>
        /// "Thêm công đoạn" on a tooth another công đoạn of the line already
        /// holds — that tooth is continued ("Tiếp tục công đoạn"), not started again.
        /// </summary>
        public const string StageToothAlreadyStaged = "BlueDental:Treatment:0031";

        /// <summary>A công đoạn on a tooth-bearing line with no tooth picked.</summary>
        public const string StageTeethRequired = "BlueDental:Treatment:0032";

        /// <summary>
        /// A warranty raised while another warranty of the same line is still
        /// open. The reference's own words, `openWarrantyMustComplete`.
        /// </summary>
        public const string OpenWarrantyMustComplete = "BlueDental:Treatment:0033";

        /// <summary>The service carries no warranty period ("Không bảo hành").</summary>
        public const string ServiceHasNoWarranty = "BlueDental:Treatment:0034";

        /// <summary>The warranty period ran out ("Đã hết hạn bảo hành").</summary>
        public const string WarrantyExpired = "BlueDental:Treatment:0035";

        /// <summary>A warranty raised off a công đoạn that is not a finished, live one.</summary>
        public const string WarrantySourceInvalid = "BlueDental:Treatment:0036";

        /// <summary>
        /// "Chỉnh sửa" on a line that is finished, cancelled, converted or already
        /// paid — the reference offers the pencil on none of those.
        /// </summary>
        public const string ServiceLineNotEditable = "BlueDental:Treatment:0037";

        /// <summary>
        /// A line being treated keeps its diagnosis and its price — the reference
        /// prints "Không thể đổi chẩn đoán/giá khi đang điều trị" in their place.
        /// </summary>
        public const string ServiceLineLockedInTreatment = "BlueDental:Treatment:0038";

        /// <summary>A tooth that already has a công đoạn cannot be taken off the line.</summary>
        public const string StagedToothLocked = "BlueDental:Treatment:0039";

        /// <summary>
        /// A line's unit price may be lowered below its "giá gốc" but never raised
        /// above it — the reference's "Đơn giá không được lớn hơn giá gốc của dịch vụ."
        /// </summary>
        public const string UnitPriceAboveOriginal = "BlueDental:Treatment:0040";

        /// <summary>A continue asked for a tooth its công đoạn no longer holds open.</summary>
        public const string StageToothNotOpen = "BlueDental:Treatment:0041";

        /// <summary>The discount is above the account's "giảm tối đa %" (Cụm 11 mục 12).</summary>
        public const string DiscountAbovePercent = "BlueDental:Treatment:0042";

        /// <summary>The discount is above the account's "giảm tối đa VNĐ" (Cụm 11 mục 12).</summary>
        public const string DiscountAboveUserAmount = "BlueDental:Treatment:0043";

        /// <summary>
        /// A prescription picked a diagnosis from a phiếu điều trị that is not the
        /// patient's live one in this branch, or that phiếu carries no such diagnosis.
        /// </summary>
        public const string PrescriptionDiagnosisSourceInvalid = "BlueDental:Treatment:0044";

        /// <summary>The same diagnosis of the same phiếu điều trị is picked twice.</summary>
        public const string DuplicatePrescriptionDiagnosis = "BlueDental:Treatment:0045";

        /// <summary>"Ngày điều trị" after today — a công đoạn is written for a day already worked.</summary>
        public const string StageTreatmentDateInFuture = "BlueDental:Treatment:0046";
    }

    public static class Billing
    {
        public const string InvoiceNotFound = "BlueDental:Billing:0001";
        public const string InvalidInvoiceTransition = "BlueDental:Billing:0002";
        public const string InvoiceAlreadyPaid = "BlueDental:Billing:0003";
        public const string PaymentAccountRequired = "BlueDental:Billing:0090";
        public const string InvalidPaymentAllocation = "BlueDental:Billing:0091";

        /// <summary>
        /// ABP prints the string its resource holds for the code, not the one
        /// passed to the exception — so a reason the cashier needs to read has
        /// to have a code of its own.
        /// </summary>
        public const string PaymentExceedsOutstanding = "BlueDental:Billing:0092";

        public const string RefundExceedsPaid = "BlueDental:Billing:0093";

        /// <summary>A receipt cannot be dated after today (bug list item 26).</summary>
        public const string PaymentDateInFuture = "BlueDental:Billing:0094";

        /// <summary>A receipt is cancelled with a reason, never silently (bug list item 28).</summary>
        public const string PaymentCancelReasonRequired = "BlueDental:Billing:0095";

        /// <summary>A "Hoàn tất" receipt is final: it cannot be edited, confirmed again or cancelled.</summary>
        public const string PaymentAlreadyCompleted = "BlueDental:Billing:0096";

        /// <summary>A "Chưa thanh toán" receipt has no money behind it yet, so it cannot be e-invoiced.</summary>
        public const string PaymentNotCompleted = "BlueDental:Billing:0097";
        public const string InsufficientPaymentAmount = "BlueDental:Billing:0004";
        public const string InsuranceClaimNotFound = "BlueDental:Billing:0005";
        public const string InvalidCurrency = "BlueDental:Billing:0006";
        public const string NegativeAmount = "BlueDental:Billing:0007";
        public const string VoidReasonRequired = "BlueDental:Billing:0008";
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

    public static class Labo
    {
        public const string OrderNotFound = "BlueDental:Labo:0001";
        public const string InvalidTransition = "BlueDental:Labo:0002";
        public const string DuplicateOrderCode = "BlueDental:Labo:0003";
        public const string MaterialNeedsGroup = "BlueDental:Labo:0004";
        public const string LogoTooLarge = "BlueDental:Labo:0005";
        public const string LogoNotAnImage = "BlueDental:Labo:0006";
        public const string LogoNotFound = "BlueDental:Labo:0007";
        /// <summary>Làm tiếp công đoạn / Bảo hành without a parent order.</summary>
        public const string ParentRequired = "BlueDental:Labo:0008";
        /// <summary>The parent belongs to another patient or branch.</summary>
        public const string ParentMismatch = "BlueDental:Labo:0009";
        /// <summary>Mirrors the reference: no child order once the service line is done.</summary>
        public const string TreatmentServiceCompleted = "BlueDental:Labo:0010";
        /// <summary>Mirrors the reference: a child order must name a material.</summary>
        public const string MaterialRequired = "BlueDental:Labo:0011";
        /// <summary>Mirrors the reference's "Chỉ được huỷ đơn hàng mới" on the detail dialog.</summary>
        public const string CancelOnlyNew = "BlueDental:Labo:0012";
        /// <summary>"Ngày và giờ nhận dự kiến phải sau ngày và giờ gửi."</summary>
        public const string DueBeforeSent = "BlueDental:Labo:0013";
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
        public const string VoucherPerCustomerLimitReached = "BlueDental:Promotions:0010";
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
        public const string InvalidColorCode = "BlueDental:Finance:0010";
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
        public const string PastDayAttendance = "BlueDental:Timekeeping:0011";
        public const string AttendanceNotToday = "BlueDental:Timekeeping:0012";
        public const string ScheduleCellLocked = "BlueDental:Timekeeping:0013";
        public const string InvalidLeaveWindow = "BlueDental:Timekeeping:0014";
        public const string LeaveDaysRequired = "BlueDental:Timekeeping:0015";
        public const string StaffNotInBranch = "BlueDental:Timekeeping:0016";
        public const string LeaveInPast = "BlueDental:Timekeeping:0017";
    }

    public static class CustomerCare
    {
        public const string RecordNotFound = "BlueDental:CustomerCare:0001";
        public const string InvalidTransition = "BlueDental:CustomerCare:0002";
        public const string InvalidSchedule = "BlueDental:CustomerCare:0003";
        public const string OutcomeRequired = "BlueDental:CustomerCare:0004";
    }

    public static class Operations
    {
        public const string InvalidTaskTransition = "BlueDental:Operations:0001";
        public const string EmptyArticleContent = "BlueDental:Operations:0002";
        // 0003-0005 were the image codes, now FileManagement's. Left listed so
        // the numbers are not handed out twice.
    }

    /// <summary>Images and files a rich-text body links to.</summary>
    public static class FileManagement
    {
        public const string UnsupportedImage = "BlueDental:FileManagement:0001";
        public const string ImageTooLarge = "BlueDental:FileManagement:0002";
        public const string ImageNotFound = "BlueDental:FileManagement:0003";
    }

    public static class Staff
    {
        public const string InvalidPhoneNumber = "BlueDental:Staff:0001";
        public const string InvalidTimeFormat = "BlueDental:Staff:0002";
        public const string AvatarFileRequired = "BlueDental:Staff:0003";
        public const string UnsupportedAvatarType = "BlueDental:Staff:0004";
        public const string AvatarTooLarge = "BlueDental:Staff:0005";
        public const string AvatarNotFound = "BlueDental:Staff:0006";
        public const string DuplicateEmail = "BlueDental:Staff:0007";

        /// <summary>"Quy định giảm giá": % outside 0–100 or a negative amount (Cụm 11 mục 12).</summary>
        public const string InvalidDiscountLimit = "BlueDental:Staff:0008";

        /// <summary>"Ngày kết thúc hợp đồng" before "Ngày bắt đầu" (Cụm 11 mục 1).</summary>
        public const string ContractEndsBeforeStart = "BlueDental:Staff:0009";

        /// <summary>A chứng chỉ hành nghề issued after today (Cụm 11 mục 1).</summary>
        public const string CertificateIssuedInFuture = "BlueDental:Staff:0010";

        /// <summary>A "Loại hợp đồng" value the list does not have.</summary>
        public const string InvalidContractType = "BlueDental:Staff:0011";
    }

    public static class StaffPenalty
    {
        /// <summary>Only a draft can be edited, approved or deleted.</summary>
        public const string NotDraft = "BlueDental:StaffPenalty:0001";
        public const string AlreadyCancelled = "BlueDental:StaffPenalty:0002";
        public const string FineAmountRequired = "BlueDental:StaffPenalty:0003";
        public const string ViolationDateInFuture = "BlueDental:StaffPenalty:0004";
        /// <summary>The staff member does not work at the record's branch.</summary>
        public const string StaffNotInBranch = "BlueDental:StaffPenalty:0005";
        /// <summary>The violation type belongs to another branch, or was deleted.</summary>
        public const string InvalidViolationType = "BlueDental:StaffPenalty:0006";
        public const string InvalidAmount = "BlueDental:StaffPenalty:0007";
        public const string DuplicateViolationTypeName = "BlueDental:StaffPenalty:0008";
    }

    /// <summary>Marketing → Ticket (F-55). BlueDental-local.</summary>
    public static class MarketingTicket
    {
        /// <summary>Not a Vietnamese phone number once spaces and +84 are taken off.</summary>
        public const string InvalidPhone = "BlueDental:MarketingTicket:0001";
        /// <summary>Đã đến / Không tiềm năng: nothing more to record until it is reopened.</summary>
        public const string TicketClosed = "BlueDental:MarketingTicket:0002";
        /// <summary>Hẹn gọi lại needs a time to call back, later than now.</summary>
        public const string CallBackTimeRequired = "BlueDental:MarketingTicket:0003";
        /// <summary>The ticket's status does not allow this step.</summary>
        public const string InvalidTransition = "BlueDental:MarketingTicket:0004";
        /// <summary>The customer has a record, so the appointment needs a dentist.</summary>
        public const string DentistRequired = "BlueDental:MarketingTicket:0005";
        public const string AssigneeNotInBranch = "BlueDental:MarketingTicket:0006";
        /// <summary>A tag of another branch, or one deleted.</summary>
        public const string InvalidTag = "BlueDental:MarketingTicket:0007";
        public const string DuplicateTagName = "BlueDental:MarketingTicket:0008";
        /// <summary>Another open ticket of the branch already holds the phone.</summary>
        public const string DuplicateOpenPhone = "BlueDental:MarketingTicket:0009";
        /// <summary>The ticket is someone else's and the caller may only see their own.</summary>
        public const string NotYours = "BlueDental:MarketingTicket:0010";
        /// <summary>Booking goes into the branch the screen is on, so the ticket has to be of that branch.</summary>
        public const string BookFromOtherBranch = "BlueDental:MarketingTicket:0012";
        /// <summary>Ticket File: not an .xlsx workbook ClosedXML can open.</summary>
        public const string ImportInvalidFile = "BlueDental:MarketingTicket:0013";
        /// <summary>Ticket File: no data row under the header row.</summary>
        public const string ImportNoRows = "BlueDental:MarketingTicket:0014";
        /// <summary>Ticket File: Họ tên or Số điện thoại is not mapped to a column of the file, or a mapping points outside it.</summary>
        public const string ImportColumnMissing = "BlueDental:MarketingTicket:0015";
    }

    /// <summary>Bảng lương (Cụm 11 mục 5–6). BlueDental-local.</summary>
    public static class Payroll
    {
        /// <summary>Lương cơ bản / phụ cấp below zero.</summary>
        public const string InvalidCompensation = "BlueDental:Payroll:0001";
        /// <summary>A month outside 1–12 or a year outside 2000–2100.</summary>
        public const string InvalidPeriod = "BlueDental:Payroll:0002";
        /// <summary>Ngày công chuẩn outside (0, 31] or hệ số tăng ca outside [1, 5].</summary>
        public const string InvalidTerms = "BlueDental:Payroll:0003";
        /// <summary>A finalized sheet cannot be recalculated, edited or deleted.</summary>
        public const string NotDraft = "BlueDental:Payroll:0004";
        /// <summary>A negative bonus / deduction, or a corrected ngày công outside 0–31.</summary>
        public const string InvalidAdjustment = "BlueDental:Payroll:0005";
        /// <summary>The branch already has a sheet for that month.</summary>
        public const string DuplicatePeriod = "BlueDental:Payroll:0006";
    }

    /// <summary>Mối quan hệ (4.8) and Hồ sơ nhóm (4.10). BlueDental-local.</summary>
    public static class PatientRelation
    {
        /// <summary>A record related to itself.</summary>
        public const string SelfRelation = "BlueDental:PatientRelation:0001";
        /// <summary>The two records are already related.</summary>
        public const string DuplicateRelation = "BlueDental:PatientRelation:0002";
        /// <summary>An unknown relation or group kind / role.</summary>
        public const string InvalidType = "BlueDental:PatientRelation:0003";
        /// <summary>A group with no member.</summary>
        public const string GroupNeedsMember = "BlueDental:PatientRelation:0004";
        /// <summary>The same record twice in a group.</summary>
        public const string DuplicateMember = "BlueDental:PatientRelation:0005";
        /// <summary>More members than a group may hold.</summary>
        public const string TooManyMembers = "BlueDental:PatientRelation:0006";
        /// <summary>More than one Chủ hộ / Trưởng nhóm.</summary>
        public const string OneHead = "BlueDental:PatientRelation:0007";
        /// <summary>The record already belongs to another family group.</summary>
        public const string AlreadyInFamily = "BlueDental:PatientRelation:0008";
    }

    public static class Queue
    {
        public const string TicketNotFound = "BlueDental:Queue:0001";
        public const string InvalidTransition = "BlueDental:Queue:0002";
        public const string AlreadyQueued = "BlueDental:Queue:0003";
        public const string CounterRequired = "BlueDental:Queue:0004";
        public const string CounterPaused = "BlueDental:Queue:0005";
        public const string CounterPausedTakeNumber = "BlueDental:Queue:0006";
        public const string DuplicatePrefix = "BlueDental:Queue:0007";
        public const string DentistLocked = "BlueDental:Queue:0008";
        public const string DentistTaken = "BlueDental:Queue:0009";
        public const string InvalidPrefix = "BlueDental:Queue:0010";
        public const string InvalidCounterSettings = "BlueDental:Queue:0011";
        public const string NotADentist = "BlueDental:Queue:0012";
        public const string DentistRequired = "BlueDental:Queue:0013";
    }

    public static class Tools
    {
        public const string ConfigurationNotFound = "BlueDental:Tools:0001";
        public const string DuplicateSip = "BlueDental:Tools:0002";
        public const string ZaloNotConnected = "BlueDental:Tools:0003";
        public const string ZaloNotEnabled = "BlueDental:Tools:0004";
        public const string ZaloInvalidPhone = "BlueDental:Tools:0005";
        public const string ZaloRequestFailed = "BlueDental:Tools:0006";
        public const string ZaloNotConfigured = "BlueDental:Tools:0007";
        public const string ZaloTemplateDataMissing = "BlueDental:Tools:0008";
        public const string ZaloOaMismatch = "BlueDental:Tools:0009";
    }

    public static class ClinicIntegration
    {
        public const string ConnectionNotFound = "BlueDental:ClinicIntegration:0001";
        public const string DuplicateConnection = "BlueDental:ClinicIntegration:0002";
        public const string ConnectionNotActive = "BlueDental:ClinicIntegration:0003";
        public const string ServiceCatalogSyncDisabled = "BlueDental:ClinicIntegration:0004";
        public const string InvalidPartnerUrl = "BlueDental:ClinicIntegration:0005";
        public const string ServiceNotInBranch = "BlueDental:ClinicIntegration:0006";
        public const string EmptySelection = "BlueDental:ClinicIntegration:0007";
    }

    public static class EInvoicing
    {
        public const string NotConfigured = "BlueDental:EInvoicing:0001";
        public const string ReceiptNotInvoiceable = "BlueDental:EInvoicing:0002";
        public const string ProviderRefused = "BlueDental:EInvoicing:0003";
        public const string AlreadyPublished = "BlueDental:EInvoicing:0004";
        public const string InvalidDraft = "BlueDental:EInvoicing:0005";
        public const string IssueInProgress = "BlueDental:EInvoicing:0006";
        public const string InvalidConfig = "BlueDental:EInvoicing:0007";
        public const string DuplicateActiveConfig = "BlueDental:EInvoicing:0008";
        public const string ReceiptInvoiced = "BlueDental:EInvoicing:0009";
        public const string AmountExceedsSource = "BlueDental:EInvoicing:0010";
        public const string SourceRequired = "BlueDental:EInvoicing:0011";
        public const string SourceAlreadyInvoiced = "BlueDental:EInvoicing:0012";
        public const string ConfigIncomplete = "BlueDental:EInvoicing:0013";
        /// <summary>The lines carry different % thuế; one invoice takes one rate.</summary>
        public const string MixedVatRates = "BlueDental:EInvoicing:0016";
        public const string PatternRequired = "BlueDental:EInvoicing:0014";
        public const string CurrencyNotSupported = "BlueDental:EInvoicing:0015";
        /// <summary>"Xuất hóa đơn đỏ" needs Tên khách hàng, Mã số thuế, Số ĐT and Email.</summary>
        public const string BuyerDetailsRequired = "BlueDental:EInvoicing:0017";
    }

    /// <summary>PHIẾU THU printed by Phát Hành in the Hóa đơn dialog.</summary>
    public static class PaymentReceipt
    {
        public const string TemplateMissing = "BlueDental:PaymentReceipt:0001";
        public const string RenderFailed = "BlueDental:PaymentReceipt:0002";
    }

    public static class BranchManager
    {
        public const string DuplicateEmail = "BlueDental:BranchManager:0001";
        public const string InvalidPhoneNumber = "BlueDental:BranchManager:0002";
        public const string AvatarFileRequired = "BlueDental:BranchManager:0003";
        public const string UnsupportedAvatarType = "BlueDental:BranchManager:0004";
        public const string AvatarTooLarge = "BlueDental:BranchManager:0005";
        public const string AvatarNotFound = "BlueDental:BranchManager:0006";
    }
}
