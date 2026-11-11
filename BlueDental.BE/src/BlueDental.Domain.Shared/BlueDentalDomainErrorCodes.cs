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
        public const string InvalidCode = "BlueDental:Organizations:0009";
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
        /// <summary>A save would drop a service's công đoạn that a patient's công đoạn has already ticked.</summary>
        public const string StageInUse = "BlueDental:Catalogs:0035";
        /// <summary>A "Vật liệu nha khoa" entry must be a crown or an implant.</summary>
        public const string InvalidRestorationKind = "BlueDental:Catalogs:0036";
        /// <summary>Kind / brand / origin / warranty belong to the "Vật liệu nha khoa" catalog only.</summary>
        public const string RestorationOutsideCatalog = "BlueDental:Catalogs:0037";
        /// <summary>The groups of "Vật liệu nha khoa" are fixed: none is added, renamed or deleted.</summary>
        public const string FixedTaxonomyGroups = "BlueDental:Catalogs:0038";
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

        /// <summary>
        /// The phone is neither a national number (8–15 digits) nor an
        /// international one ("+" country code, at most 15 digits in all).
        /// </summary>
        public const string InvalidPhone = "BlueDental:Patient:0023";

        /// <summary>A sheet's drawing is not a PNG, or is larger than MedicalRecordDrawing allows.</summary>
        public const string InvalidMedicalRecordDrawing = "BlueDental:Patient:0024";

        /// <summary>The bộ hồ sơ bệnh án is cancelled: nothing in it may change any more.</summary>
        public const string MedicalRecordSetCancelled = "BlueDental:Patient:0025";

        /// <summary>
        /// The treatment slip has started (it is no longer "Đã tạo") and is already
        /// in a bộ hồ sơ, so it can no longer leave it.
        /// </summary>
        public const string MedicalRecordSetPlanLocked = "BlueDental:Patient:0026";

        /// <summary>A bộ hồ sơ is made from at least one treatment slip.</summary>
        public const string MedicalRecordSetNeedsPlan = "BlueDental:Patient:0027";

        /// <summary>The sheet was cancelled ("Đã hủy") and may no longer be changed.</summary>
        public const string MedicalRecordSheetCancelled = "BlueDental:Patient:0028";

        /// <summary>The treatment slip is cancelled, or is not this patient's.</summary>
        public const string MedicalRecordSetPlanUnavailable = "BlueDental:Patient:0029";

        /// <summary>Cancelling a sheet needs a reason.</summary>
        public const string MedicalRecordCancelReasonRequired = "BlueDental:Patient:0030";

        /// <summary>
        /// Another live set holds the slip. A set — new or edited — takes free
        /// slips only; the slip is taken out of its set first.
        /// </summary>
        public const string MedicalRecordSetPlanTaken = "BlueDental:Patient:0032";

        /// <summary>A bộ hồ sơ shows at least one of the nine forms in its index.</summary>
        public const string MedicalRecordSetNeedsForm = "BlueDental:Patient:0031";

        /// <summary>
        /// The phone is already held by another hồ sơ, and the save did not say
        /// how the new person is related to one of them (P2710_02).
        /// </summary>
        public const string SharedPhoneLinkRequired = "BlueDental:Patient:0033";

        /// <summary>The "của …" pick does not hold the number, or may not be picked for that relation.</summary>
        public const string SharedPhoneAnchorInvalid = "BlueDental:Patient:0034";

        /// <summary>Another hồ sơ on the same phone already has this full name (P2710_02).</summary>
        public const string DuplicateNameOnPhone = "BlueDental:Patient:0035";

        /// <summary>A công đoạn picture may only be deleted on the day it was uploaded (P0111_02).</summary>
        public const string StageImageDeleteExpired = "BlueDental:Patient:0036";
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

        /// <summary>The patient already arrived (CheckedInAt is set), so the visit cannot be Trễ hẹn (R-1034).</summary>
        public const string ArrivedCannotBeLate = "BlueDental:Appointment:0016";

        /// <summary>
        /// "Đổi lịch hẹn" (outcome FollowUp) moves a visit whose work is not done yet,
        /// so it is refused once the visit is in the chair or finished; those close
        /// with "Hẹn tái khám" instead (owner 2026-10-27, docs/P2710.drawio).
        /// </summary>
        public const string RescheduleAfterStart = "BlueDental:Appointment:0017";

        /// <summary>
        /// "Tiếp nhận" on a "Lịch tạm": reception makes the patient record first,
        /// so the visit is seated against a real patient (BA 2026-11-02).
        /// </summary>
        public const string TemporaryNeedsRecord = "BlueDental:Appointment:0018";
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

        // 0047 retired (R-951): "Ngày điều trị" before the slip was opened is allowed again.

        /// <summary>"Ngày lên đơn thuốc" after today — a prescription is dated on or before the day it is written.</summary>
        public const string PrescriptionDateInFuture = "BlueDental:Treatment:0048";

        /// <summary>"Xóa" on a service line that is no longer "Đã tạo" (R-953).</summary>
        public const string ServiceNotRemovable = "BlueDental:Treatment:0049";

        /// <summary>"Xóa" on a service line that already has a receipt or refund against it (R-953).</summary>
        public const string ServiceHasPayments = "BlueDental:Treatment:0050";

        /// <summary>"Xóa" on a service line that already has công đoạn, tái khám or labo orders (R-953).</summary>
        public const string ServiceHasRecords = "BlueDental:Treatment:0051";

        /// <summary>
        /// The slip's page opened by a user whose part of the Sơ đồ tổ chức holds
        /// none of its Bác sĩ điều trị (R-961) — the slip the "Kế hoạch điều trị"
        /// tab already hides from them.
        /// </summary>
        public const string PlanOutsideTreatingScope = "BlueDental:Treatment:0052";

        /// <summary>"Bảo hành dịch vụ" on a line that is not Hoàn thành (P3110 REQ-B5).</summary>
        public const string WarrantyLineNotDone = "BlueDental:Treatment:0053";

        /// <summary>
        /// A dental warranty card for a tooth the line does not treat, a tooth asked
        /// twice, or a tooth that already has its card (P3110 REQ-B5).
        /// </summary>
        public const string WarrantyToothInvalid = "BlueDental:Treatment:0054";

        /// <summary>"Ngày bắt đầu bảo hành" before the day the line was finished (P3110 REQ-B5).</summary>
        public const string WarrantyStartBeforeCompletion = "BlueDental:Treatment:0055";

        /// <summary>"Thời hạn" outside 1..600 months (P3110 REQ-B5).</summary>
        public const string WarrantyDurationInvalid = "BlueDental:Treatment:0056";

        /// <summary>A warranty card photo for a tooth not being activated, or a side sent twice (P3110 REQ-B5).</summary>
        public const string WarrantyCardPhotoInvalid = "BlueDental:Treatment:0057";

        /// <summary>A warranty công đoạn that names no "Thẻ bảo hành áp dụng" (P3110 REQ-F7).</summary>
        public const string WarrantyKindRequired = "BlueDental:Treatment:0058";

        /// <summary>"Nha khoa" picked on a line with no dental warranty card still running (P3110 REQ-F7).</summary>
        public const string WarrantyCardNotValid = "BlueDental:Treatment:0059";

        /// <summary>
        /// "Labo" picked without a Labo order of the line whose warranty is still
        /// running, or a Labo order sent with "Nha khoa" (P3110 REQ-F7).
        /// </summary>
        public const string WarrantyLaboOrderInvalid = "BlueDental:Treatment:0060";

        /// <summary>A warranty công đoạn on a tooth its card does not cover (P3110 REQ-F7).</summary>
        public const string WarrantyToothNotCovered = "BlueDental:Treatment:0061";

        /// <summary>
        /// "Bảo hành dịch vụ" while a Labo order of the line has not passed QC:
        /// the clinic's warranty is the line's final lock (BA 2026-11-02).
        /// </summary>
        public const string WarrantyLaboUnfinished = "BlueDental:Treatment:0062";

        /// <summary>
        /// Hoàn thành / Tạo Labo on a công đoạn older than its line's newest
        /// "Ngày điều trị": continue it to the newest day instead (BA 2026-11-02).
        /// </summary>
        public const string StageDateLocked = "BlueDental:Treatment:0063";

        /// <summary>Deleting a công đoạn a Labo order still hangs on: cancel the order first.</summary>
        public const string StageDeleteHasLabo = "BlueDental:Treatment:0064";

        /// <summary>
        /// Deleting a công đoạn something was built on top of — continued
        /// further, or warrantied: delete the newer row first.
        /// </summary>
        public const string StageDeleteHasSuccessor = "BlueDental:Treatment:0065";

        /// <summary>
        /// Writing a công đoạn of a line that was converted (Chuyển đổi) or
        /// cancelled: the line is closed, its history read-only (BA 2026-11-10, R-1186).
        /// </summary>
        public const string StageLineClosed = "BlueDental:Treatment:0066";
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

        /// <summary>An exported or paid receipt is locked: it cannot be edited or confirmed again.</summary>
        public const string PaymentAlreadyCompleted = "BlueDental:Billing:0096";

        /// <summary>A receipt not yet "Đã thanh toán" has no money behind it, so it cannot be e-invoiced.</summary>
        public const string PaymentNotCompleted = "BlueDental:Billing:0097";

        /// <summary>✓ "Xác nhận thanh toán" only follows "Đã xuất phiếu thu" (P2610).</summary>
        public const string PaymentNotIssued = "BlueDental:Billing:0098";

        /// <summary>An exported or paid receipt is cancelled with one of the four fixed reasons.</summary>
        public const string PaymentCancelReasonCodeRequired = "BlueDental:Billing:0099";

        /// <summary>A cancelled receipt is final.</summary>
        public const string PaymentAlreadyCancelled = "BlueDental:Billing:0100";

        /// <summary>
        /// A paid receipt whose money was partly refunded cannot be cancelled:
        /// the service would read as having paid back more than it took.
        /// </summary>
        public const string PaymentCancelBelowRefunded = "BlueDental:Billing:0101";

        /// <summary>The branch's iPad shows another receipt; the message names it ({0}).</summary>
        public const string SigningDeviceBusy = "BlueDental:Billing:0102";

        /// <summary>The signing session ended (cancelled, replaced or exported) before this step.</summary>
        public const string SigningSessionClosed = "BlueDental:Billing:0103";

        /// <summary>Ký tên comes after both boxes of the review screen are ticked.</summary>
        public const string SigningNotChecked = "BlueDental:Billing:0104";

        /// <summary>The signature is not a PNG drawing, or is empty or too large.</summary>
        public const string SignatureInvalid = "BlueDental:Billing:0105";

        /// <summary>The branch has no iPad paired (Kết nối iPad in the clinic settings).</summary>
        public const string SigningDeviceMissing = "BlueDental:Billing:0106";

        /// <summary>The server has no ReceiptVault:Key, so nothing can be encrypted.</summary>
        public const string ReceiptVaultKeyMissing = "BlueDental:Billing:0107";

        /// <summary>Only a receipt still "Chưa thanh toán" goes to the iPad.</summary>
        public const string ReceiptNotSendable = "BlueDental:Billing:0108";

        /// <summary>A paired iPad needs a name to tell it apart.</summary>
        public const string SigningDeviceNameRequired = "BlueDental:Billing:0109";

        /// <summary>Yêu cầu khách ký lại needs a signature to redo.</summary>
        public const string SigningNotSigned = "BlueDental:Billing:0110";

        /// <summary>The iPad's link is unknown or was revoked: it must be paired again.</summary>
        public const string SigningDeviceNotPaired = "BlueDental:Billing:0111";

        /// <summary>Xuất phiếu thu needs the customer's signature from the iPad first.</summary>
        public const string ReceiptNotSignedByCustomer = "BlueDental:Billing:0112";

        /// <summary>Ký số is not available yet (P2610 phase 7).</summary>
        public const string ReceiptDigitalSignUnavailable = "BlueDental:Billing:0113";

        /// <summary>The receipt has no exported PDF (not exported, or exported before P2610 phase 5).</summary>
        public const string ReceiptFileMissing = "BlueDental:Billing:0114";

        /// <summary>The stored PDF no longer matches the SHA-256 taken at export.</summary>
        public const string ReceiptFileTampered = "BlueDental:Billing:0115";

        /// <summary>P2910: a line's TN giảm and voucher share let off more than it still owes.</summary>
        public const string ReliefExceedsOutstanding = "BlueDental:Billing:0116";

        /// <summary>P2910_02: Ký điện tử picked by an accountant who has no saved signature yet.</summary>
        public const string AccountantSignatureMissing = "BlueDental:Billing:0117";

        /// <summary>P2910_02: an accountant's signature image over 200 KB once shrunk.</summary>
        public const string AccountantSignatureTooLarge = "BlueDental:Billing:0118";

        /// <summary>P2910_02: the receipt was printed for a hand signature, so the iPad is out of its flow.</summary>
        public const string ReceiptSignedOnPaper = "BlueDental:Billing:0119";
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
        /// <summary>A supplier's label colour that is not #RRGGBB (R-1072).</summary>
        public const string InvalidLabelColor = "BlueDental:Labo:0014";

        // P2910_03 workflow (F-85).
        /// <summary>Tạo phiếu Labo with a required order field still empty.</summary>
        public const string OrderIncomplete = "BlueDental:Labo:0015";
        /// <summary>Hình ảnh gửi Labo: at most five per set (the shared ones, or one tooth's).</summary>
        public const string ImageCountInvalid = "BlueDental:Labo:0016";
        /// <summary>Số lượng nhận outside 1 … Số lượng đặt.</summary>
        public const string ReceivedQuantityInvalid = "BlueDental:Labo:0017";
        public const string ReceivedBeforeSent = "BlueDental:Labo:0018";
        /// <summary>A tooth waiting for its check has no Đạt / Lỗi.</summary>
        public const string ToothResultsIncomplete = "BlueDental:Labo:0019";
        public const string ToothNotOnOrder = "BlueDental:Labo:0020";
        /// <summary>Trả toàn bộ / Trả hàng bị lỗi with no tooth marked Lỗi.</summary>
        public const string ReturnNeedsDefect = "BlueDental:Labo:0021";
        /// <summary>Xác nhận Labo đạt while a tooth is marked Lỗi.</summary>
        public const string NotAllPassed = "BlueDental:Labo:0022";
        /// <summary>Ngày trả hàng or Hẹn Labo giao lại missing.</summary>
        public const string ReturnDetailsRequired = "BlueDental:Labo:0023";
        public const string RedeliveryBeforeReturn = "BlueDental:Labo:0024";
        /// <summary>Ảnh kiểm tra is required once a tooth is marked Lỗi.</summary>
        public const string CheckImagesRequired = "BlueDental:Labo:0025";
        /// <summary>Kích hoạt bảo hành before the order is Hoàn thành.</summary>
        public const string WarrantyNotAvailable = "BlueDental:Labo:0026";
        /// <summary>Only a passed tooth whose warranty is not active yet.</summary>
        public const string ToothNotWarrantable = "BlueDental:Labo:0027";
        public const string WarrantyStartBeforePass = "BlueDental:Labo:0028";
        public const string WarrantyMonthsInvalid = "BlueDental:Labo:0029";
        public const string DeleteOnlyDraft = "BlueDental:Labo:0030";
        /// <summary>A later công đoạn of the service while its labo order has not passed QC.</summary>
        public const string StageLockedByLabo = "BlueDental:Labo:0031";
        /// <summary>Dịch vụ điều trị that is not one of this customer's plan lines.</summary>
        public const string TreatmentServiceMismatch = "BlueDental:Labo:0032";
        /// <summary>Hoàn thành of a service line while its labo order has not passed QC.</summary>
        public const string ServiceLockedByLabo = "BlueDental:Labo:0033";
        /// <summary>Gửi Labo while a tooth (or one of its split surfaces) lacks Màu răng; data "tooth" names it.</summary>
        public const string ToothSpecIncomplete = "BlueDental:Labo:0034";
        /// <summary>Gửi Labo while a tooth has no Mặt răng picked (R-1150); data "tooth" names it.</summary>
        public const string ToothSurfaceMissing = "BlueDental:Labo:0038";
        /// <summary>A Mặt răng code the tooth does not have (I/F on a molar, O/B on an incisor); data "tooth", "surface".</summary>
        public const string ToothSurfaceInvalid = "BlueDental:Labo:0039";
        /// <summary>Trả hàng while a Lỗi tooth has no Mô tả gửi Labo (P3110 REQ-D6); data "tooth" names it.</summary>
        public const string DefectDescriptionRequired = "BlueDental:Labo:0035";
        /// <summary>Ảnh thẻ for a tooth not being activated, or two of one face (P3110 REQ-E1).</summary>
        public const string WarrantyCardPhotoInvalid = "BlueDental:Labo:0036";
        /// <summary>Kích hoạt bảo hành on an order with no service line: its card number has none to count on (P3110 R-1090).</summary>
        public const string WarrantyNeedsServiceLine = "BlueDental:Labo:0037";
        /// <summary>Trả hàng while a Lỗi tooth with ordered Mặt răng has no Mặt bị lỗi picked (R-1151); data "tooth".</summary>
        public const string FaultSurfaceMissing = "BlueDental:Labo:0040";
        /// <summary>A Mặt bị lỗi the tooth was not ordered on (R-1151); data "tooth", "surface".</summary>
        public const string FaultSurfaceInvalid = "BlueDental:Labo:0041";
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
        public const string ScheduleDayLocked = "BlueDental:Timekeeping:0018";
        public const string ScheduleNotEditable = "BlueDental:Timekeeping:0019";
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

        /// <summary>A negative "Mức độ ưu tiên".</summary>
        public const string InvalidPriority = "BlueDental:Staff:0012";

        /// <summary>A "Màu nhãn" that is not "#RRGGBB" (R-1155).</summary>
        public const string InvalidLabelColor = "BlueDental:Staff:0013";
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

    /// <summary>Nhân sự → Sơ đồ tổ chức (F-67). BlueDental-local.</summary>
    public static class OrgChart
    {
        /// <summary>Another unit already carries the name — case and stray spaces aside, accents kept.</summary>
        public const string DuplicateName = "BlueDental:OrgChart:0001";
        /// <summary>Another unit already carries the code.</summary>
        public const string DuplicateCode = "BlueDental:OrgChart:0002";
        /// <summary>A Phòng ban sits under the root; a Team under a Phòng ban or the root.</summary>
        public const string InvalidParent = "BlueDental:OrgChart:0003";
        /// <summary>Every unit below the root needs a Trưởng đơn vị.</summary>
        public const string HeadRequired = "BlueDental:OrgChart:0004";
        /// <summary>One person heads at most one unit.</summary>
        public const string AlreadyHeadsUnit = "BlueDental:OrgChart:0005";
        /// <summary>The root (Tổng giám đốc) cannot be deleted, renamed or moved.</summary>
        public const string RootLocked = "BlueDental:OrgChart:0006";
        /// <summary>A Phòng ban that still has teams under it.</summary>
        public const string HasChildren = "BlueDental:OrgChart:0007";
        /// <summary>A member who heads another unit cannot be moved out of it.</summary>
        public const string MemberHeadsOtherUnit = "BlueDental:OrgChart:0010";
        /// <summary>No such active staff member.</summary>
        public const string UnknownStaff = "BlueDental:OrgChart:0011";
        /// <summary>A dentist reaching for the Lịch làm việc of someone outside their part of the chart.</summary>
        public const string OutsideScheduleScope = "BlueDental:OrgChart:0012";
        /// <summary>A staff member who heads a Phòng ban / Team cannot be deleted until someone else heads it.</summary>
        public const string StaffHeadsUnit = "BlueDental:OrgChart:0013";
        /// <summary>The head cannot be removed from their own unit; change the head first.</summary>
        public const string HeadCannotLeave = "BlueDental:OrgChart:0014";
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
        public const string DuplicateName = "BlueDental:Queue:0014";
        public const string CounterHasQueue = "BlueDental:Queue:0015";
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
        public const string TemplateNameRequired = "BlueDental:Tools:0010";
        public const string TemplatePurposeRequired = "BlueDental:Tools:0011";
        public const string TemplateContentRequired = "BlueDental:Tools:0012";
        public const string TemplateSubjectRequired = "BlueDental:Tools:0013";
        public const string TemplateUnknownVariables = "BlueDental:Tools:0014";
        public const string TemplateZnsRequired = "BlueDental:Tools:0015";
        public const string TemplateZnsParamUnmapped = "BlueDental:Tools:0016";
        public const string TemplateTooLong = "BlueDental:Tools:0017";

        // CSKH ▸ Gửi tin nhắn (BA P2110, F-77).
        public const string SendChannelNotConnected = "BlueDental:Tools:0018";
        public const string SendTemplateNotReady = "BlueDental:Tools:0019";
        public const string SendNoRecipients = "BlueDental:Tools:0020";
        public const string SendScheduleInPast = "BlueDental:Tools:0021";
        public const string SendNoTestPhone = "BlueDental:Tools:0022";
        public const string SendNotCancellable = "BlueDental:Tools:0023";
        public const string SendListRequired = "BlueDental:Tools:0024";
        public const string SendTooManyRecipients = "BlueDental:Tools:0025";

        // Tổng quan ▸ Thống kê CSKH (BA P2110, F-78).
        public const string StatsPeriodReversed = "BlueDental:Tools:0026";
        public const string StatsPeriodTooLong = "BlueDental:Tools:0027";
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

    /// <summary>"Yêu cầu xuất HĐ" and the QR form behind it (F-71).</summary>
    public static class InvoiceRequest
    {
        public const string FullNameRequired = "BlueDental:InvoiceRequest:0001";
        public const string InvalidPhone = "BlueDental:InvoiceRequest:0002";
        public const string InvalidEmail = "BlueDental:InvoiceRequest:0003";
        public const string CompanyTaxCodeRequired = "BlueDental:InvoiceRequest:0004";
        public const string InvalidTaxCode = "BlueDental:InvoiceRequest:0005";
        public const string InvalidNationalId = "BlueDental:InvoiceRequest:0006";
        public const string InvalidBirthYear = "BlueDental:InvoiceRequest:0007";
        /// <summary>The receipt already has a request that is not cancelled.</summary>
        public const string AlreadyRequested = "BlueDental:InvoiceRequest:0008";
        public const string InvalidTransition = "BlueDental:InvoiceRequest:0009";
        public const string ReasonRequired = "BlueDental:InvoiceRequest:0010";
        public const string InvoiceNoRequired = "BlueDental:InvoiceRequest:0011";
        public const string LinkExpired = "BlueDental:InvoiceRequest:0012";
        public const string LinkUsed = "BlueDental:InvoiceRequest:0013";
        /// <summary>Only a payment receipt can be invoiced, not a refund or a cancelled one.</summary>
        public const string ReceiptNotEligible = "BlueDental:InvoiceRequest:0014";
        /// <summary>The receipt was "Hủy phiếu": its QR and its link are void.</summary>
        public const string ReceiptCancelled = "BlueDental:InvoiceRequest:0015";
        /// <summary>A personal invoice (Cá nhân) needs the CCCD.</summary>
        public const string NationalIdRequired = "BlueDental:InvoiceRequest:0016";
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

    /// <summary>The header's "Thêm ghi chú" dialog (F-74).</summary>
    public static class StaffNotes
    {
        public const string ContentRequired = "BlueDental:StaffNote:0001";
        public const string ContentTooLong = "BlueDental:StaffNote:0002";
        public const string BranchRequired = "BlueDental:StaffNote:0003";
        public const string NotOwner = "BlueDental:StaffNote:0004";
        public const string InvalidScope = "BlueDental:StaffNote:0005";
    }

    /// <summary>CSKH ▸ Hộp thư Zalo (BA P2210, F-80). BlueDental-local.</summary>
    public static class ZaloInbox
    {
        /// <summary>Someone else holds the conversation ("Nhận xử lý" taken).</summary>
        public const string HeldByOther = "BlueDental:ZaloInbox:0001";
        /// <summary>Replying, handing on or letting go needs the conversation held by the caller.</summary>
        public const string NotHolder = "BlueDental:ZaloInbox:0002";
        /// <summary>Zalo takes a "tin tư vấn" only within 48 hours of the customer's last message.</summary>
        public const string ReplyWindowClosed = "BlueDental:ZaloInbox:0003";
        public const string MessageRequired = "BlueDental:ZaloInbox:0004";
        public const string MessageTooLong = "BlueDental:ZaloInbox:0005";
        /// <summary>The colleague is not staff of the branch, inactive, or lacks Hộp thư Zalo › Xử lý.</summary>
        public const string InvalidAssignee = "BlueDental:ZaloInbox:0006";
        public const string TagTooLong = "BlueDental:ZaloInbox:0007";
        public const string TooManyTags = "BlueDental:ZaloInbox:0008";
        public const string NoteRequired = "BlueDental:ZaloInbox:0009";
        public const string NoteTooLong = "BlueDental:ZaloInbox:0010";
        /// <summary>A struck-through note stays as it was.</summary>
        public const string NoteRemoved = "BlueDental:ZaloInbox:0011";
        /// <summary>ZNS goes to a phone: the conversation needs a linked record with one.</summary>
        public const string NoPatientPhone = "BlueDental:ZaloInbox:0012";
        public const string TransferToSelf = "BlueDental:ZaloInbox:0013";
    }

    /// <summary>Chat nội bộ (F-89).</summary>
    public static class Chat
    {
        public const string ContentRequired = "BlueDental:Chat:0001";
        public const string ContentTooLong = "BlueDental:Chat:0002";
        public const string NotMember = "BlueDental:Chat:0003";
        public const string NotSender = "BlueDental:Chat:0004";
        public const string MessageRecalled = "BlueDental:Chat:0005";
        public const string GroupNameRequired = "BlueDental:Chat:0006";
        public const string GroupNameTooLong = "BlueDental:Chat:0007";
        public const string MemberNotInBranch = "BlueDental:Chat:0008";
        public const string DirectWithSelf = "BlueDental:Chat:0009";
        public const string GroupOnly = "BlueDental:Chat:0010";
        public const string InvalidAttachment = "BlueDental:Chat:0011";
        public const string TooManyAttachments = "BlueDental:Chat:0012";
        public const string AttachmentUnavailable = "BlueDental:Chat:0013";
        public const string BranchRequired = "BlueDental:Chat:0014";
        public const string GroupNeedsMembers = "BlueDental:Chat:0015";
        public const string TooManyMembers = "BlueDental:Chat:0016";
        public const string AttachmentTooLarge = "BlueDental:Chat:0017";
        public const string AttachmentInfected = "BlueDental:Chat:0018";
        public const string MalwareScanUnavailable = "BlueDental:Chat:0019";
        public const string SendingTooFast = "BlueDental:Chat:0020";
        public const string NotGroupOwner = "BlueDental:Chat:0021";
        public const string CannotRemoveSelf = "BlueDental:Chat:0022";
        public const string EditWindowExpired = "BlueDental:Chat:0023";
        public const string EditConflict = "BlueDental:Chat:0024";
        public const string TooManyPatients = "BlueDental:Chat:0025";
        /// <summary>Unknown, deleted or of another branch: one answer, so the reply tells nothing about other branches.</summary>
        public const string PatientUnavailable = "BlueDental:Chat:0026";
        /// <summary>Without Patients.View only patients booked or checked in today can be tagged (K1).</summary>
        public const string PatientNotToday = "BlueDental:Chat:0027";
    }

    /// <summary>Liên kết máy X-quang (F-95).</summary>
    public static class Imaging
    {
        public const string DeviceNameRequired = "BlueDental:Imaging:0001";
        /// <summary>Unknown or revoked token: one answer for both, so a guess learns nothing.</summary>
        public const string DeviceNotPaired = "BlueDental:Imaging:0002";
        /// <summary>Not a JPEG or PNG by its first bytes, whatever its name says.</summary>
        public const string InvalidImage = "BlueDental:Imaging:0003";
        public const string ImageTooLarge = "BlueDental:Imaging:0004";
        public const string ImageInfected = "BlueDental:Imaging:0005";
        public const string MalwareScanUnavailable = "BlueDental:Imaging:0006";
        public const string InboxItemNotFound = "BlueDental:Imaging:0007";
        /// <summary>The picture was already put on a record or set aside.</summary>
        public const string InboxItemHandled = "BlueDental:Imaging:0008";
        /// <summary>Unknown, deleted or of another branch: one answer.</summary>
        public const string PatientUnavailable = "BlueDental:Imaging:0009";
    }
}
