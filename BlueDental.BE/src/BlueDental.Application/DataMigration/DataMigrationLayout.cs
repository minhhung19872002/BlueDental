using BlueDental.Catalogs.Import;

namespace BlueDental.DataMigration;

/// <summary>
/// The data sheets of BlueDental_Migration.xlsx. As with the catalog
/// import, the headers are the file contract — the same Vietnamese text in any
/// UI language — and only the guide text is localized.
/// </summary>
internal static class DataMigrationLayout
{
    public static class Col
    {
        public const string Code = "code";
        public const string FullName = "fullName";
        public const string DateOfBirth = "dateOfBirth";
        public const string Gender = "gender";
        public const string Phone = "phone";
        public const string Email = "email";
        public const string Address = "address";
        public const string OldAddress = "oldAddress";
        public const string NationalId = "nationalId";
        public const string InsuranceNumber = "insuranceNumber";
        public const string Source = "source";
        public const string Channel = "channel";
        public const string Occupation = "occupation";
        public const string DiseaseHistory = "diseaseHistory";
        public const string Tags = "tags";
        public const string ExaminationReason = "examinationReason";
        public const string Note = "note";
        public const string EmergencyName = "emergencyName";
        public const string EmergencyPhone = "emergencyPhone";
        public const string RegisteredOn = "registeredOn";
        public const string GuardianName = "guardianName";
        public const string GuardianPhone = "guardianPhone";
        public const string GuardianNationalId = "guardianNationalId";
        public const string GuardianRelation = "guardianRelation";

        // Patient roster only (F-69).
        public const string LegacyId = "legacyId";
        public const string Branch = "branch";
        public const string Province = "province";
        public const string Ward = "ward";
        public const string Action = "action";

        public const string TreatedOn = "treatedOn";
        public const string SlipCode = "slipCode";
        public const string Service = "service";
        public const string StageName = "stageName";
        public const string Teeth = "teeth";
        public const string Content = "content";
        public const string Dentist = "dentist";
        public const string AssistingDoctor = "assistingDoctor";
        public const string Assistant = "assistant";
        public const string Status = "status";

        // Điều trị: money and grouping (old-system extension, 2026-10-13).
        public const string PlanKey = "planKey";
        public const string Quantity = "quantity";
        public const string OriginalPrice = "originalPrice";
        public const string Price = "price";
        public const string Amount = "amount";

        // Thanh toán.
        public const string PaidSlip = "paidSlip";
        public const string PaidPlan = "paidPlan";
        public const string PaidOn = "paidOn";
        public const string PaidAmount = "paidAmount";
        public const string Method = "method";
        public const string Account = "account";
        public const string Cashier = "cashier";
        public const string PaymentNote = "paymentNote";

        // Lịch hẹn.
        public const string BookedAt = "bookedAt";
        public const string BookedMinutes = "bookedMinutes";
        public const string BookedDentist = "bookedDentist";
        public const string BookedStatus = "bookedStatus";
        public const string BookedNote = "bookedNote";
        public const string CancelNote = "cancelNote";
    }

    /// <summary>Mã KH on the history sheets: a reference to a patient, repeated once per row.</summary>
    private static readonly ImportColumn PatientRef = new(Col.Code, "Mã KH", true, "DataMigration:Hint:patientRef", 14);

    private static ImportColumn Column(string key, string header, bool required, double width = 20) =>
        new(key, header, required, "DataMigration:Hint:" + key, width);

    public static readonly ImportSheetLayout Patients = new("Khách hàng",
    [
        Column(Col.Code, "Mã KH", true, 14),
        Column(Col.FullName, "Họ và tên", true, 28),
        Column(Col.DateOfBirth, "Ngày sinh", false, 13),
        Column(Col.Gender, "Giới tính", false, 10),
        Column(Col.Phone, "Số điện thoại", false, 15),
        Column(Col.Email, "Email", false, 24),
        Column(Col.Address, "Địa chỉ", false, 36),
        Column(Col.OldAddress, "Địa chỉ cũ", false, 30),
        Column(Col.NationalId, "CCCD", false, 15),
        Column(Col.InsuranceNumber, "Số BHYT", false, 17),
        Column(Col.Source, "Nguồn đến", false, 18),
        Column(Col.Channel, "Kênh", false, 18),
        Column(Col.Occupation, "Nghề nghiệp", false, 18),
        Column(Col.DiseaseHistory, "Tiền sử bệnh", false, 28),
        Column(Col.Tags, "Thẻ hồ sơ", false, 20),
        Column(Col.ExaminationReason, "Lý do đến khám", false, 28),
        Column(Col.Note, "Ghi chú", false, 28),
        Column(Col.EmergencyName, "Người liên hệ khẩn cấp", false, 24),
        Column(Col.EmergencyPhone, "SĐT liên hệ khẩn cấp", false, 18),
        Column(Col.RegisteredOn, "Ngày tạo hồ sơ", false, 14),
        Column(Col.GuardianName, "Người giám hộ - Họ tên", false, 24),
        Column(Col.GuardianPhone, "Người giám hộ - SĐT", false, 18),
        Column(Col.GuardianNationalId, "Người giám hộ - CCCD", false, 18),
        Column(Col.GuardianRelation, "Người giám hộ - Quan hệ", false, 22)
    ]);

    public static readonly ImportSheetLayout Treatments = new("Điều trị",
    [
        PatientRef,
        Column(Col.TreatedOn, "Ngày điều trị", true, 14),
        Column(Col.SlipCode, "Mã phiếu", false, 14),
        Column(Col.Service, "Dịch vụ", true, 30),
        Column(Col.StageName, "Công đoạn", false, 24),
        Column(Col.Teeth, "Răng", false, 14),
        Column(Col.Content, "Nội dung điều trị", false, 40),
        Column(Col.Dentist, "Bác sĩ điều trị", true, 22),
        Column(Col.AssistingDoctor, "Bác sĩ hỗ trợ", false, 22),
        Column(Col.Assistant, "Phụ tá", false, 22),
        Column(Col.Status, "Trạng thái", false, 16),
        // Added after the F-61 columns so a file written to the first template still reads the same.
        Column(Col.PlanKey, "Kế hoạch", false, 20),
        Column(Col.Quantity, "Số lượng", false, 10),
        Column(Col.OriginalPrice, "Đơn giá gốc", false, 14),
        Column(Col.Price, "Đơn giá", false, 14),
        Column(Col.Amount, "Thành tiền", false, 14)
    ]);

    /// <summary>
    /// The money the old system collected, one row per receipt. Optional:
    /// found by name only, so a two-sheet F-61 file still imports as before.
    /// </summary>
    public static readonly ImportSheetLayout Payments = new("Thanh toán",
    [
        PatientRef,
        Column(Col.PaidSlip, "Mã phiếu", false, 14),
        Column(Col.PaidPlan, "Kế hoạch", false, 20),
        Column(Col.PaidOn, "Ngày thu", true, 13),
        Column(Col.PaidAmount, "Số tiền", true, 14),
        Column(Col.Method, "Hình thức", false, 16),
        Column(Col.Account, "Tài khoản nhận", false, 22),
        Column(Col.Cashier, "Người thu", false, 22),
        Column(Col.PaymentNote, "Ghi chú", false, 36)
    ]);

    /// <summary>
    /// The old system's bookings, past and future, one row per booking.
    /// Optional and found by name only, like Thanh toán.
    /// </summary>
    public static readonly ImportSheetLayout Bookings = new("Lịch hẹn",
    [
        PatientRef,
        Column(Col.BookedAt, "Ngày giờ hẹn", true, 17),
        Column(Col.BookedMinutes, "Thời lượng (phút)", false, 12),
        Column(Col.BookedDentist, "Bác sĩ", true, 22),
        Column(Col.BookedStatus, "Trạng thái", false, 14),
        Column(Col.BookedNote, "Nội dung", false, 40),
        Column(Col.CancelNote, "Lý do hủy", false, 28)
    ]);
}
