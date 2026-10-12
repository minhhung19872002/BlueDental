using System.Collections.Generic;
using BlueDental.Catalogs.Import;
using static BlueDental.DataMigration.DataMigrationLayout;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// The one sheet of the patient roster file (F-69, BA 2026-10-12): the export
/// writes it and the import reads it back, so the headers are the contract —
/// the same Vietnamese text in any UI language. The column keys are the
/// migration file's (F-61), so one row reader serves both.
/// </summary>
internal static class PatientRosterLayout
{
    /// <summary>E adds or edits the row's patient; D deletes it; a blank cell leaves the row alone.</summary>
    public const string EditAction = "e";
    public const string DeleteAction = "d";

    private static ImportColumn Column(string key, string header, bool required, double width = 20) =>
        new(key, header, required, "DataMigration:Hint:" + key, width);

    public static readonly ImportSheetLayout Sheet = new("Bệnh nhân",
    [
        Column(Col.FullName, "Họ và tên", true, 28),
        Column(Col.Phone, "Số điện thoại", true, 15),
        Column(Col.Code, "Mã khách hàng", false, 15),
        Column(Col.Branch, "Chi nhánh", true, 22),
        Column(Col.LegacyId, "ID hệ thống", false, 14),
        Column(Col.Gender, "Giới tính", false, 10),
        Column(Col.DateOfBirth, "Ngày sinh", false, 13),
        Column(Col.NationalId, "CCCD", false, 15),
        Column(Col.Email, "Email", false, 24),
        Column(Col.Note, "Ghi chú", false, 28),
        Column(Col.Occupation, "Nghề nghiệp", false, 18),
        Column(Col.InsuranceNumber, "Số thẻ BHYT", false, 17),
        Column(Col.Address, "Địa chỉ", false, 32),
        Column(Col.Province, "Tỉnh/TP", false, 18),
        Column(Col.Ward, "Phường/Xã", false, 20),
        Column(Col.OldAddress, "Địa chỉ cũ", false, 30),
        Column(Col.Source, "Nguồn đến", false, 18),
        Column(Col.Channel, "Kênh", false, 18),
        Column(Col.RegisteredOn, "Ngày tạo hồ sơ", false, 14),
        Column(Col.ExaminationReason, "Lý do đến khám", false, 28),
        Column(Col.Tags, "Thẻ hồ sơ", false, 20),
        Column(Col.DiseaseHistory, "Tiền sử bệnh", false, 28),
        Column(Col.EmergencyName, "Người liên hệ khẩn cấp", false, 24),
        Column(Col.EmergencyPhone, "SĐT liên hệ khẩn cấp", false, 18),
        Column(Col.GuardianName, "Người giám hộ - Họ tên", false, 24),
        Column(Col.GuardianPhone, "Người giám hộ - SĐT", false, 18),
        Column(Col.GuardianNationalId, "Người giám hộ - CCCD", false, 18),
        Column(Col.GuardianRelation, "Người giám hộ - Quan hệ", false, 22),
        Column(Col.Action, "Action", false, 10)
    ]);

    /// <summary>Older headers a hand-made file may still use (the migration file's).</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Aliases = new Dictionary<string, string[]>
    {
        [Col.Code] = ["Mã KH"],
        [Col.InsuranceNumber] = ["Số BHYT"],
        [Col.Province] = ["Tỉnh/Thành phố", "Tỉnh / TP"],
        [Col.Ward] = ["Phường / Xã"]
    };
}
