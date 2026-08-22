using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

public class CareRecordDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public CareType Type { get; set; }
    public CareStatus Status { get; set; }
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public string? Resolution { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? PatientName { get; set; }
}

public class CreateCareRecordDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AssignedStaffId { get; set; }
    public CareType Type { get; set; }
    public string Subject { get; set; } = default!;
    public string? Description { get; set; }
    public DateTimeOffset? DueAt { get; set; }
}

public class GetCareRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public CareStatus? Status { get; set; }
    public CareType? Type { get; set; }
    public string? Filter { get; set; }
}
