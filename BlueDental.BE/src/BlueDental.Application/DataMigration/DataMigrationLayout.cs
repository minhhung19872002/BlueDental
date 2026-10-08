using BlueDental.Catalogs.Import;

namespace BlueDental.DataMigration;

/// <summary>
/// The two data sheets of BlueDental_Migration.xlsx. As with the catalog
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
    }

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
        Column(Col.Code, "Mã KH", true, 14),
        Column(Col.TreatedOn, "Ngày điều trị", true, 14),
        Column(Col.SlipCode, "Mã phiếu", false, 14),
        Column(Col.Service, "Dịch vụ", true, 30),
        Column(Col.StageName, "Công đoạn", false, 24),
        Column(Col.Teeth, "Răng", false, 14),
        Column(Col.Content, "Nội dung điều trị", false, 40),
        Column(Col.Dentist, "Bác sĩ điều trị", true, 22),
        Column(Col.AssistingDoctor, "Bác sĩ hỗ trợ", false, 22),
        Column(Col.Assistant, "Phụ tá", false, 22),
        Column(Col.Status, "Trạng thái", false, 16)
    ]);
}
