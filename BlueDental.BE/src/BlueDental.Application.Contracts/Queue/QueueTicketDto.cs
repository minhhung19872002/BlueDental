using System;
using System.Collections.Generic;
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
    public Guid? DentistId { get; set; }
    public string? DentistName { get; set; }
    public string NumberPrefix { get; set; } = default!;
    public int StartNumber { get; set; }
    public bool AutoResetDaily { get; set; }
    public int WaitWarningMinutes { get; set; }
    public int MinutesPerPatient { get; set; }

    /// <summary>"Hiện đã cấp đến A018" — null until the sequence hands out a number.</summary>
    public string? LastIssuedNumber { get; set; }

    /// <summary>Tickets waiting at, or being seen by, this counter today.</summary>
    public int InQueueCount { get; set; }
}

public class CreateServiceCounterDto
{
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    public Guid? DentistId { get; set; }
    public string NumberPrefix { get; set; } = default!;
    public int StartNumber { get; set; } = 1;
    public bool AutoResetDaily { get; set; } = true;
    public int WaitWarningMinutes { get; set; } = 30;
    public int MinutesPerPatient { get; set; } = 12;
}

public class UpdateServiceCounterDto : CreateServiceCounterDto
{
}

public class CallTicketInput
{
    public Guid? CounterId { get; set; }
}

/// <summary>
/// One counter as the main screen and the TV show it: its dentist, the
/// number being seen, the next numbers of its own queue and how long they
/// have waited. No PHI.
/// </summary>
public class CounterBoardDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public bool IsActive { get; set; }
    public string NumberPrefix { get; set; } = default!;
    public Guid? DentistId { get; set; }
    public string? DentistName { get; set; }
    public int WaitWarningMinutes { get; set; }

    /// <summary>Today's real average when a visit has finished, else the configured one.</summary>
    public int MinutesPerPatient { get; set; }

    public BoardTicketDto? Current { get; set; }

    /// <summary>The first numbers of the counter's queue, in calling order.</summary>
    public List<BoardTicketDto> Upcoming { get; set; } = [];

    public int WaitingCount { get; set; }
    public int LongestWaitMinutes { get; set; }

    /// <summary>"Số mới chờ ~x′": how long a number taken now would wait.</summary>
    public int NewTicketWaitMinutes { get; set; }
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

/// <summary>"Hàng chờ · Quầy số 2": one counter's waiting list with its estimates.</summary>
public class CounterQueueDto
{
    public CounterBoardDto Counter { get; set; } = default!;
    public int ConfiguredMinutesPerPatient { get; set; }
    public double? ActualMinutesPerPatient { get; set; }

    /// <summary>"Số tiếp theo cấp: B016".</summary>
    public string NextNumber { get; set; } = default!;

    public List<CounterQueueRowDto> Waiting { get; set; } = [];
}

public class CounterQueueRowDto
{
    public Guid Id { get; set; }
    public string DisplayNumber { get; set; } = default!;
    public QueueTicketPriority Priority { get; set; }
    public string? ServiceType { get; set; }
    public DateTime TakenAt { get; set; }
    public int WaitedMinutes { get; set; }
    public DateTimeOffset EstimatedCallAt { get; set; }
}
