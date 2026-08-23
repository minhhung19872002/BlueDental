using System;
using System.Collections.Generic;
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
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? ScheduledStart { get; set; }
    public DateTimeOffset? ScheduledEnd { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? ZaloSentAt { get; set; }
    public List<Guid> StageIds { get; set; } = new();

    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public string? AssignedStaffName { get; set; }
    public string? CareStaffName { get; set; }
    public string? CareServiceName { get; set; }
}

public class CreateCareRecordDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public CareType Type { get; set; }
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? CareServiceId { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public List<Guid> StageIds { get; set; } = new();
}

public class UpdateCareRecordDto
{
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? CareStaffId { get; set; }
    public DateTimeOffset? ScheduledStart { get; set; }
    public DateTimeOffset? ScheduledEnd { get; set; }
}

public class GetCareRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public CareStatus? Status { get; set; }
    public CareType? Type { get; set; }
    public Guid? CareStaffId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }
    public string? Filter { get; set; }
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

/// <summary>
/// Counters above the CSKH grouping table: Tổng khách · Thành công · Thất bại ·
/// Chưa CS · Đã gửi Zalo.
/// </summary>
public class CareStatsDto
{
    public int TotalPatients { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public int NotCaredYet { get; set; }
    public int ZaloSent { get; set; }

    /// <summary>Đánh giá breakdown shown on the patient's care tab.</summary>
    public int Good { get; set; }
    public int Fair { get; set; }
    public int Normal { get; set; }
    public int Complaint { get; set; }
}
