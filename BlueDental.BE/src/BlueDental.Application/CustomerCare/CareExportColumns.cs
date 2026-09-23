using System;
using System.Collections.Generic;
using BlueDental.Appointments;
using BlueDental.Exporting;
using BlueDental.PatientManagement;

namespace BlueDental.CustomerCare;

/// <summary>
/// The "BE:Common:ExportExcel" column sets of the CSKH board, one per care tab.
///
/// The staging file is the UI table plus "Mã KH", "Giới tính" and "Ngày sinh"
/// inserted around the name column, and every cell is a string — dates as
/// dd/MM/yyyy (birthdays) or dd/MM/yyyy HH:mm (appointments), statuses as their
/// Vietnamese labels, "Chưa có lịch hẹn" when there is no upcoming appointment.
/// </summary>
public static class CareExportColumns
{
    public static IReadOnlyCollection<ExcelColumn<CareRecordDto>> For(CareType? type) => type switch
    {
        CareType.AfterTreatment => AfterTreatment,
        CareType.Birthday => Birthday,
        CareType.AppointmentReminder => Reminder,
        CareType.NoService => NoService,
        _ => Scheduled,
    };

    /// <summary>Sau điều trị — 13 cột (width 20/14/24/12/16/16/20/28/30/16/20/16/36).</summary>
    private static readonly ExcelColumn<CareRecordDto>[] AfterTreatment =
    [
        new("Ngày CSKH", r => DateTimeText(r.DueAt), 20),
        new("Mã KH", r => r.PatientCode, 14),
        new("Họ và tên", r => r.PatientName, 24),
        new("Giới tính", r => GenderLabel(r.PatientGender), 12),
        new("Ngày sinh", r => DateText(r.PatientDateOfBirth), 16),
        new("Số điện thoại", r => r.PatientPhone, 16),
        new("Bác sĩ điều trị", r => r.AssignedStaffName, 20),
        new("Dịch vụ", r => string.Join("\n", r.ServiceNames), 28),
        new("Phản hồi khách hàng", r => r.Resolution ?? string.Empty, 30),
        new("Trạng thái đánh giá", r => OutcomeLabel(r.Outcome), 16),
        new("Lịch hẹn sắp tới", r => NextAppointmentText(r.NextAppointmentAt), 20),
        new("Trạng thái", r => StatusLabel(r.Status), 16),
        new("Ghi chú", r => r.Description, 36),
    ];

    /// <summary>Chúc mừng sinh nhật — 7 cột.</summary>
    private static readonly ExcelColumn<CareRecordDto>[] Birthday =
    [
        new("Mã KH", r => r.PatientCode, 14),
        new("Họ và tên", r => r.PatientName, 24),
        new("Giới tính", r => GenderLabel(r.PatientGender), 12),
        new("Ngày sinh", r => DateText(r.PatientDateOfBirth), 16),
        new("Số điện thoại", r => r.PatientPhone, 16),
        new("Trạng thái", r => StatusLabel(r.Status), 16),
        new("Ghi chú", r => r.Description, 36),
    ];

    /// <summary>Nhắc lịch hẹn — 12 cột.</summary>
    private static readonly ExcelColumn<CareRecordDto>[] Reminder =
    [
        new("Lịch hẹn", r => DateTimeText(r.DueAt), 20),
        new("Mã KH", r => r.PatientCode, 14),
        new("Họ và tên", r => r.PatientName, 24),
        new("Giới tính", r => GenderLabel(r.PatientGender), 12),
        new("Ngày sinh", r => DateText(r.PatientDateOfBirth), 16),
        new("Số điện thoại", r => r.PatientPhone, 16),
        new("Bác sĩ điều trị", r => r.AssignedStaffName, 20),
        new("NV chăm sóc", r => r.CareStaffName, 20),
        new("Nội dung lịch hẹn", r => r.AppointmentContent, 24),
        new("Trạng thái lịch hẹn", r => AppointmentStatusLabel(r.AppointmentStatus), 20),
        new("Trạng thái CSKH", r => StatusLabel(r.Status), 16),
        new("Ghi chú", r => r.Description, 36),
    ];

    /// <summary>Không làm dịch vụ — 10 cột.</summary>
    private static readonly ExcelColumn<CareRecordDto>[] NoService =
    [
        new("Ngày CSKH", r => DateTimeText(r.DueAt), 20),
        new("Mã KH", r => r.PatientCode, 14),
        new("Họ và tên", r => r.PatientName, 24),
        new("Giới tính", r => GenderLabel(r.PatientGender), 12),
        new("Ngày sinh", r => DateText(r.PatientDateOfBirth), 16),
        new("Số điện thoại", r => r.PatientPhone, 16),
        new("Bác sĩ điều trị", r => r.AssignedStaffName, 20),
        new("Lịch hẹn sắp tới", r => NextAppointmentText(r.NextAppointmentAt), 20),
        new("Trạng thái", r => StatusLabel(r.Status), 16),
        new("Ghi chú", r => r.Description, 36),
    ];

    /// <summary>CSKH định kì / đặc biệt — 11 cột (width 20/14/24/12/16/16/20/20/20/16/36).</summary>
    private static readonly ExcelColumn<CareRecordDto>[] Scheduled =
    [
        new("Lịch hẹn CSKH", r => DateTimeText(r.ScheduledStart), 20),
        new("Mã KH", r => r.PatientCode, 14),
        new("Họ và tên", r => r.PatientName, 24),
        new("Giới tính", r => GenderLabel(r.PatientGender), 12),
        new("Ngày sinh", r => DateText(r.PatientDateOfBirth), 16),
        new("Số điện thoại", r => r.PatientPhone, 16),
        new("Bác sĩ điều trị", r => r.AssignedStaffName, 20),
        new("NV chăm sóc", r => r.CareStaffName, 20),
        new("Lịch hẹn sắp tới", r => NextAppointmentText(r.NextAppointmentAt), 20),
        new("Trạng thái", r => StatusLabel(r.Status), 16),
        new("Ghi chú", r => r.Description, 36),
    ];

    private static string DateText(DateOnly? date) =>
        date?.ToString("dd/MM/yyyy") ?? string.Empty;

    private static string DateTimeText(DateTimeOffset? at) =>
        at?.ToLocalTime().ToString("dd/MM/yyyy HH:mm") ?? string.Empty;

    private static string NextAppointmentText(DateTimeOffset? at) =>
        at.HasValue ? DateTimeText(at) : "Chưa có lịch hẹn";

    private static string StatusLabel(CareStatus status) => status switch
    {
        CareStatus.Succeeded => "Thành công",
        CareStatus.Failed => "Thất bại",
        CareStatus.Cancelled => "Đã hủy",
        _ => "Chưa liên hệ",
    };

    /// <summary>Nhãn màu vocabulary; the staging cell is empty until rated.</summary>
    private static string OutcomeLabel(CareOutcome outcome) => outcome switch
    {
        CareOutcome.Good => "Rất tốt",
        CareOutcome.Fair => "Tốt",
        CareOutcome.Normal => "Bình thường",
        CareOutcome.Complaint => "Phàn nàn",
        _ => string.Empty,
    };

    private static string GenderLabel(Gender? gender) => gender switch
    {
        Gender.Male => "Nam",
        Gender.Female => "Nữ",
        Gender.Other => "Khác",
        _ => string.Empty,
    };

    private static string AppointmentStatusLabel(AppointmentStatus? status) => status switch
    {
        AppointmentStatus.Requested => "Đã hẹn",
        AppointmentStatus.Confirmed => "Đã xác nhận",
        AppointmentStatus.CheckedIn => "Đã đến",
        AppointmentStatus.InProgress => "Đang khám",
        AppointmentStatus.Completed => "Đã khám",
        AppointmentStatus.Cancelled => "Hủy hẹn",
        AppointmentStatus.NoShow => "Trễ hẹn",
        _ => string.Empty,
    };
}
