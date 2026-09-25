using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Queue;

public class QueueTicketDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public DateOnly QueueDate { get; set; }
    public int TicketNumber { get; set; }
    public string DisplayNumber { get; set; } = default!;
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public Guid? AppointmentId { get; set; }
    public QueueTicketStatus Status { get; set; }
    public QueueTicketPriority Priority { get; set; }
    public string? ServiceType { get; set; }
    public Guid? DentistId { get; set; }
    public string? DentistName { get; set; }
    public Guid? CounterId { get; set; }
    public string? CounterName { get; set; }
    public DateTimeOffset? CalledAt { get; set; }
    public DateTimeOffset? ServingAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? SkippedAt { get; set; }
    public int CallCount { get; set; }
    public string? Note { get; set; }
}

public class CreateQueueTicketDto
{
    public Guid? PatientId { get; set; }
    public Guid? AppointmentId { get; set; }
    public QueueTicketPriority Priority { get; set; }
    public string? ServiceType { get; set; }
    public Guid? DentistId { get; set; }
    public Guid? CounterId { get; set; }
    public string? Note { get; set; }
}

public class GetQueueTicketListInput : PagedAndSortedResultRequestDto
{
    public DateOnly? Date { get; set; }
    public QueueTicketStatus? Status { get; set; }
    public Guid? CounterId { get; set; }
}

/// <summary>
/// Lightweight DTO for the TV display — no PHI fields.
/// </summary>
public class QueueDisplayDto
{
    public Guid Id { get; set; }
    public string DisplayNumber { get; set; } = default!;
    public QueueTicketStatus Status { get; set; }
    public QueueTicketPriority Priority { get; set; }
    public string? ServiceType { get; set; }
    public Guid? CounterId { get; set; }
    public string? CounterName { get; set; }
    public DateTimeOffset? CalledAt { get; set; }
    public int CallCount { get; set; }
}

public class QueueStatsDto
{
    public int TotalToday { get; set; }
    public int Waiting { get; set; }
    public int Called { get; set; }
    public int Serving { get; set; }
    public int Completed { get; set; }
    public int Skipped { get; set; }
    public int WaitingWarning { get; set; }
    public int WaitingDanger { get; set; }
    public double? AverageWaitMinutes { get; set; }
}

public class ServiceCounterDto
{
    public Guid Id { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateServiceCounterDto
{
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
}

public class UpdateServiceCounterDto
{
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
}

public class CallTicketInput
{
    public Guid? CounterId { get; set; }
}

/// <summary>
/// One reception counter as the main screen and the TV show it: what it is
/// serving now and which number the shared queue hands out next. No PHI.
/// </summary>
public class CounterBoardDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public bool IsActive { get; set; }
    public BoardTicketDto? Current { get; set; }
    public BoardTicketDto? Next { get; set; }
}

public class BoardTicketDto
{
    public Guid Id { get; set; }
    public string DisplayNumber { get; set; } = default!;
    public QueueTicketStatus Status { get; set; }
    public QueueTicketPriority Priority { get; set; }
    public string? ServiceType { get; set; }
    public DateTimeOffset? CalledAt { get; set; }
}
