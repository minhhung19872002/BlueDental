using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Tools;

/// <summary>
/// The fixed variable list of the template editor's "Thư viện biến"
/// (BA P2110: "Các biến này cố định danh sách luôn"). Keys are what a
/// template quotes as <c>{key}</c>; labels live in the localization files as
/// <c>CSKH:Var:{key}</c>. Examples and fallbacks are message text sent to
/// Vietnamese customers, not interface text, so they stay here.
/// </summary>
public static class MessageVariables
{
    public const string CustomerName = "ten_khach_hang";
    public const string Salutation = "xung_ho";
    public const string CustomerCode = "ma_khach_hang";
    public const string Phone = "so_dien_thoai";
    public const string Email = "email";
    public const string BirthDate = "ngay_sinh";
    public const string AppointmentDate = "ngay_hen";
    public const string AppointmentTime = "gio_hen";
    public const string AppointmentWeekday = "thu_hen";
    public const string AppointmentContent = "noi_dung_dich_vu";
    public const string Dentist = "bac_si";
    public const string TreatmentDate = "ngay_dieu_tri";
    public const string TreatmentService = "dich_vu_da_lam";
    public const string Debt = "so_tien_con_lai";
    public const string ClinicName = "ten_phong_kham";
    public const string Hotline = "hotline";

    public static readonly IReadOnlyList<MessageVariable> All =
    [
        new(CustomerName, MessageVariableGroup.Customer, "Nguyễn Thị Lan", MessageVariableWhenEmpty.UseFallback, "Quý khách", IsCommon: true),
        new(Salutation, MessageVariableGroup.Customer, "Chị", MessageVariableWhenEmpty.UseFallback, "Anh/Chị"),
        new(CustomerCode, MessageVariableGroup.Customer, "KH012345", MessageVariableWhenEmpty.AlwaysPresent),
        new(Phone, MessageVariableGroup.Customer, "0912 345 678", MessageVariableWhenEmpty.SkipCustomer),
        new(Email, MessageVariableGroup.Customer, "lan@gmail.com", MessageVariableWhenEmpty.SkipCustomer),
        new(BirthDate, MessageVariableGroup.Customer, "12/11/1990", MessageVariableWhenEmpty.SkipCustomer),
        new(AppointmentDate, MessageVariableGroup.Appointment, "22/10/2026", MessageVariableWhenEmpty.SkipCustomer, IsCommon: true),
        new(AppointmentTime, MessageVariableGroup.Appointment, "09:30", MessageVariableWhenEmpty.SkipCustomer, IsCommon: true),
        new(AppointmentWeekday, MessageVariableGroup.Appointment, "Thứ Năm", MessageVariableWhenEmpty.SkipCustomer),
        new(AppointmentContent, MessageVariableGroup.Appointment, "Lấy cao răng", MessageVariableWhenEmpty.UseFallback, "khám răng", IsCommon: true),
        new(Dentist, MessageVariableGroup.Appointment, "BS. Trần Minh", MessageVariableWhenEmpty.UseFallback, "bác sĩ phụ trách", IsCommon: true),
        new(TreatmentDate, MessageVariableGroup.Treatment, "18/10/2026", MessageVariableWhenEmpty.SkipCustomer),
        new(TreatmentService, MessageVariableGroup.Treatment, "Cấy Implant", MessageVariableWhenEmpty.SkipCustomer),
        new(Debt, MessageVariableGroup.Treatment, "2.500.000đ", MessageVariableWhenEmpty.AlwaysPresent),
        new(ClinicName, MessageVariableGroup.System, "Nha khoa Đức Hạnh", MessageVariableWhenEmpty.AlwaysPresent, IsCommon: true),
        new(Hotline, MessageVariableGroup.System, "1900 6900", MessageVariableWhenEmpty.AlwaysPresent, IsCommon: true),
    ];

    private static readonly Dictionary<string, MessageVariable> ByKey =
        All.ToDictionary(v => v.Key, StringComparer.Ordinal);

    public static bool IsKnown(string key) => ByKey.ContainsKey(key);

    public static MessageVariable? Find(string key) => ByKey.GetValueOrDefault(key);

    /// <summary>The "Dữ liệu ví dụ" a preview falls back to when the branch has no customer yet.</summary>
    public static IReadOnlyDictionary<string, string?> Examples { get; } =
        All.ToDictionary(v => v.Key, v => (string?)v.Example, StringComparer.Ordinal);
}

public sealed record MessageVariable(
    string Key,
    MessageVariableGroup Group,
    string Example,
    MessageVariableWhenEmpty WhenEmpty,
    string? Fallback = null,
    bool IsCommon = false);
