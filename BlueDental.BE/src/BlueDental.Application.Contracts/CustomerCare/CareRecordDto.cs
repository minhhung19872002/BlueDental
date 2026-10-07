using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

public class CareRecordDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public Guid? CareStaffId { get; set; }
    public CareType Type { get; set; }
    public CareStatus Status { get; set; }
    public CareOutcome Outcome { get; set; }
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public string? Resolution { get; set; }
    public Guid? CareServiceId { get; set; }
    public Guid? AppointmentId { get; set; }
    public DateTimeOffset? DueAt { get; set; }

    /// <summary>Ngày điều trị — sau-điều-trị tasks only.</summary>
    public DateOnly? TreatmentDate { get; set; }

    public DateTimeOffset? ScheduledStart { get; set; }
    public DateTimeOffset? ScheduledEnd { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? ZaloSentAt { get; set; }

    /// <summary>When the task was last set to Đã liên hệ, by <see cref="CareStaffName"/>.</summary>
    public DateTimeOffset? ContactedAt { get; set; }
    public List<Guid> StageIds { get; set; } = new();

    /* Enriched for the care board (reference hydrate=compact). */
    public string? PatientName { get; set; }
    public string? PatientCode { get; set; }
    [PatientPhone]
    public string? PatientPhone { get; set; }
    public Gender? PatientGender { get; set; }
    public DateOnly? PatientDateOfBirth { get; set; }
    public string? AssignedStaffName { get; set; }
    public string? CareStaffName { get; set; }
    public string? CareServiceName { get; set; }

    /// <summary>Dịch vụ — service names behind the linked treatment stages.</summary>
    public List<string> ServiceNames { get; set; } = new();

    /// <summary>Lịch hẹn sắp tới — the patient's next upcoming appointment.</summary>
    public DateTimeOffset? NextAppointmentAt { get; set; }

    /// <summary>Trạng thái lịch hẹn — only on appointment-driven rows.</summary>
    public AppointmentStatus? AppointmentStatus { get; set; }

    /// <summary>Nội dung hẹn — only on appointment-driven rows.</summary>
    public string? AppointmentContent { get; set; }

    /// <summary>Ngày hủy — when the linked appointment was cancelled (Lịch hẹn hủy).</summary>
    public DateTimeOffset? AppointmentCancelledAt { get; set; }

    /// <summary>Lý do hủy — the written cancel reason (Lịch hẹn hủy).</summary>
    public string? AppointmentCancelNote { get; set; }
}

public class CreateCareRecordDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public Guid? CareStaffId { get; set; }
    public CareType Type { get; set; }
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? CareServiceId { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? ScheduledStart { get; set; }
    public DateTimeOffset? ScheduledEnd { get; set; }

    /// <summary>
    /// The reference creates base tasks already-successful (<c>status:"success"</c>).
    /// Periodic/special dialogs send <c>status:"new"</c>.
    /// </summary>
    public CareStatus Status { get; set; } = CareStatus.New;

    /// <summary>Nhãn màu of a base task (reference <c>colorCode</c>).</summary>
    public CareOutcome Outcome { get; set; } = CareOutcome.NotRated;

    public List<Guid> StageIds { get; set; } = new();
}

/// <summary>
/// Mirrors the reference's full-object <c>PUT /customer-care/{id}</c> — the same
/// payload serves inline note editing and the care-result dialog.
/// </summary>
public class UpdateCareRecordDto
{
    public string? Subject { get; set; }
    public string? Description { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public Guid? CareStaffId { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? ScheduledStart { get; set; }
    public DateTimeOffset? ScheduledEnd { get; set; }

    /// <summary>Null = keep current status; Succeeded/Failed = care-result dialog.</summary>
    public CareStatus? Status { get; set; }

    /// <summary>
    /// Mức độ hài lòng — the patient's care tab edits the rating of a finished
    /// record (reference <c>colorCode</c> on the full-object PUT). Null keeps it.
    /// </summary>
    public CareOutcome? Outcome { get; set; }

    public List<Guid>? StageIds { get; set; }
}

public class GetCareRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public CareStatus? Status { get; set; }
    public CareType? Type { get; set; }

    /// <summary>Đánh giá chip on the patient's care tab (reference <c>colorCode</c>).</summary>
    public CareOutcome? Outcome { get; set; }

    public Guid? CareStaffId { get; set; }
    public Guid? AssignedStaffId { get; set; }

    /// <summary>
    /// Date window — compared against the clinic-local TreatmentDate for
    /// after-treatment, ScheduledStart for periodic/special, and DueAt for the rest.
    /// </summary>
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }

    /// <summary>Tìm kiếm (reference <c>q</c>) — patient name / code / phone.</summary>
    public string? Filter { get; set; }

    /// <summary>Đã liên hệ (true) / Chưa liên hệ (false) counters of the contact tabs.</summary>
    public bool? Contacted { get; set; }
}

public class SucceedCareRecordDto
{
    public CareOutcome Outcome { get; set; }
    public string? Resolution { get; set; }
}

public class FailCareRecordDto
{
    public string Reason { get; set; } = default!;
}

/// <summary>Đã liên hệ / Chưa liên hệ toggle of the sau-điều-trị tab.</summary>
public class SetCareContactStatusDto
{
    public bool Contacted { get; set; }

    [StringLength(1000)]
    public string? Note { get; set; }
}

/// <summary>One row of a care task's Lịch sử liên hệ.</summary>
public class CareContactLogDto : EntityDto<Guid>
{
    public Guid CareRecordId { get; set; }
    public CareStatus Status { get; set; }
    public string? Note { get; set; }
    public Guid? CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public DateTime CreationTime { get; set; }
}

/// <summary>
/// Counters above the CSKH grouping table: Tổng khách · Thành công · Thất bại ·
/// Chưa CS · Đã gửi Zalo.
/// </summary>
public class CareStatsDto
{
    public int TotalPatients { get; set; }

    /// <summary>
    /// Rows the filter matches — on the appointment tabs one per booking, so it
    /// is what Đã liên hệ + Chưa liên hệ add up to (bug list item 12).
    /// </summary>
    public int TotalRecords { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public int NotCaredYet { get; set; }
    public int ZaloSent { get; set; }

    /// <summary>Sau điều trị counters: Đã liên hệ · Chưa liên hệ.</summary>
    public int Contacted { get; set; }
    public int NotContacted { get; set; }

    /// <summary>Đánh giá breakdown shown on the patient's care tab.</summary>
    public int Good { get; set; }
    public int Fair { get; set; }
    public int Normal { get; set; }
    public int Complaint { get; set; }

    /// <summary>Nhóm breakdown on the patient's care tab: Đặc biệt · Định kỳ · Cơ bản.</summary>
    public int Special { get; set; }
    public int Periodic { get; set; }
    public int Base { get; set; }
}

/// <summary>
/// Phân nhóm CSKH tab — reference <c>GET /patients?excludeTreatmentNone=true</c>.
/// </summary>
public class GetCareGroupingPatientsInput : PagedResultRequestDto
{
    public Guid? BranchId { get; set; }

    /// <summary>Nhóm dịch vụ — care-service taxonomy entry.</summary>
    public Guid? TaxonomyId { get; set; }

    /// <summary>Thẻ tag (UNKNOWN_REFERENCE_BEHAVIOR — param name unverified).</summary>
    public Guid? TagId { get; set; }

    /// <summary>Ngày sinh nhật — matches month + day of the patient's birthday.</summary>
    public DateOnly? BirthdayDate { get; set; }

    /// <summary>Bác sĩ điều trị.</summary>
    public Guid? StaffId { get; set; }

    /// <summary>Tìm kiếm (reference <c>q</c>).</summary>
    public string? Filter { get; set; }

    /// <summary>
    /// Contract-parity flag — the reference always sends true yet still returns
    /// "BE:CareType:NoActivity" rows, so the filter is accepted but not applied.
    /// </summary>
    public bool ExcludeTreatmentNone { get; set; } = true;
}

/// <summary>One row of the Phân nhóm CSKH table (12 columns).</summary>
public class CareGroupingPatientDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    [PatientPhone]
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public CareTreatmentStatus TreatmentStatus { get; set; }
    public List<string> ServiceNames { get; set; } = new();
    public List<string> StaffNames { get; set; } = new();
    public decimal TotalAmount { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalDebt { get; set; }

    /// <summary>Lịch hẹn gần nhất — next upcoming appointment.</summary>
    public DateTimeOffset? NextAppointmentAt { get; set; }

    /// <summary>Lần khám cuối — last visit, falling back to record creation.</summary>
    public DateTimeOffset? LastVisitAt { get; set; }

    /// <summary>Ngày tạo hồ sơ.</summary>
    public DateTimeOffset CreatedAt { get; set; }
}
