using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Visits;

public class VisitDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public VisitStatus Status { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset ScheduledAt { get; set; }
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? CancellationReason { get; set; }
    public string? PatientName { get; set; }
    public string? DentistName { get; set; }
}

public class CreateVisitDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public DateTimeOffset ScheduledAt { get; set; }
    public string? ChiefComplaint { get; set; }
}

public class UpdateVisitDto
{
    public Guid? DentistId { get; set; }
    public DateTimeOffset? ScheduledAt { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? Notes { get; set; }
}

public class GetVisitListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public VisitStatus? Status { get; set; }
    public string? Filter { get; set; }
}
