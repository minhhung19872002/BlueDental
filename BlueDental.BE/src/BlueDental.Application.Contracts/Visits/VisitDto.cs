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
    public VisitOutcome? Outcome { get; set; }
    public DateTimeOffset? OutcomeRecordedAt { get; set; }
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

public class RecordVisitOutcomeDto
{
    public VisitOutcome Outcome { get; set; }
}

public class GetVisitListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public VisitStatus? Status { get; set; }
    public string? Filter { get; set; }
}

/// <summary>
/// The counters above the reception list. The reference shows the same six on
/// <c>/schedules/schedule_stats</c>.
/// </summary>
public class VisitStatsDto
{
    public int Total { get; set; }
    public int Scheduled { get; set; }
    public int CheckedIn { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
}
