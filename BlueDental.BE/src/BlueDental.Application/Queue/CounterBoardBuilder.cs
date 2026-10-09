using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Queue;

/// <summary>Today's ticket of one branch, as the board reads it.</summary>
internal sealed record CounterTicketRow(
    Guid Id,
    Guid? CounterId,
    string DisplayNumber,
    int TicketNumber,
    QueueTicketStatus Status,
    QueueTicketPriority Priority,
    string? ServiceType,
    DateTime CreationTime,
    DateTimeOffset? CalledAt,
    DateTimeOffset? CompletedAt);

/// <summary>
/// Turns one branch's tickets of the day into the per-counter figures of the
/// board and of a counter's waiting list. Each counter only looks at its own
/// tickets; urgent numbers go first, then the order numbers were taken.
/// </summary>
internal sealed class CounterBoardBuilder
{
    private const int UpcomingCount = 3;

    /// <summary>
    /// A visit shorter than this is not a visit: "Gọi số tiếp theo" pressed again
    /// (wrong call, patient not there) completes the previous number in seconds.
    /// </summary>
    private const double MinVisitMinutes = 2;

    /// <summary>Real visits needed today before they replace the counter's configured pace.</summary>
    private const int MinVisitSamples = 3;

    private readonly DateTimeOffset _now;
    private readonly ILookup<Guid?, CounterTicketRow> _byCounter;
    private readonly IReadOnlyDictionary<Guid, string> _dentistNames;

    public CounterBoardBuilder(
        DateTimeOffset now,
        IEnumerable<CounterTicketRow> tickets,
        IReadOnlyDictionary<Guid, string> dentistNames)
    {
        _now = now;
        _byCounter = tickets.ToLookup(t => t.CounterId);
        _dentistNames = dentistNames;
    }

    public CounterBoardDto Build(ServiceCounter counter)
    {
        var waiting = Waiting(counter.Id);
        var minutesPerPatient = EffectiveMinutesPerPatient(counter);
        var current = Current(counter.Id);
        var step = TimeSpan.FromMinutes(minutesPerPatient);

        return new CounterBoardDto
        {
            Id = counter.Id,
            Name = counter.Name,
            IsActive = counter.IsActive,
            NumberPrefix = counter.NumberPrefix,
            DentistId = counter.DentistId,
            DentistName = counter.DentistId is { } dentistId ? _dentistNames.GetValueOrDefault(dentistId) : null,
            WaitWarningMinutes = counter.WaitWarningMinutes,
            MinutesPerPatient = minutesPerPatient,
            Current = current is null ? null : ToBoardTicket(current),
            Upcoming = waiting.Take(UpcomingCount).Select(ToBoardTicket).ToList(),
            WaitingCount = waiting.Count,
            LongestWaitMinutes = waiting.Count == 0 ? 0 : waiting.Max(WaitedMinutes),
            // A new (normal) number goes after everyone waiting, who in turn wait
            // for the patient being seen now: the same clock as "Dự kiến gọi".
            NewTicketWaitMinutes = MinutesUntil(FirstCallAt(current, step) + step * waiting.Count),
        };
    }

    public CounterQueueDto BuildQueue(ServiceCounter counter, string nextNumber)
    {
        var board = Build(counter);
        var step = TimeSpan.FromMinutes(board.MinutesPerPatient);
        var firstCall = FirstCallAt(Current(counter.Id), step);

        return new CounterQueueDto
        {
            Counter = board,
            ConfiguredMinutesPerPatient = counter.MinutesPerPatient,
            ActualMinutesPerPatient = ActualMinutesPerPatient(counter.Id),
            NextNumber = nextNumber,
            Waiting = Waiting(counter.Id)
                .Select((row, index) => new CounterQueueRowDto
                {
                    Id = row.Id,
                    DisplayNumber = row.DisplayNumber,
                    Priority = row.Priority,
                    ServiceType = row.ServiceType,
                    TakenAt = AsUtc(row.CreationTime),
                    WaitedMinutes = WaitedMinutes(row),
                    EstimatedCallAt = firstCall + step * index,
                })
                .ToList(),
        };
    }

    /// <summary>Ticket numbers still in the counter's queue — a new number must not repeat one.</summary>
    public HashSet<int> NumbersInQueue(Guid counterId) =>
        _byCounter[counterId].Where(IsInQueue).Select(t => t.TicketNumber).ToHashSet();

    private List<CounterTicketRow> Waiting(Guid counterId) =>
        _byCounter[counterId]
            .Where(t => t.Status == QueueTicketStatus.Waiting)
            .OrderBy(t => t.Priority == QueueTicketPriority.Urgent ? 0 : 1)
            .ThenBy(t => t.CreationTime)
            .ThenBy(t => t.TicketNumber)
            .ToList();

    private CounterTicketRow? Current(Guid counterId) =>
        _byCounter[counterId]
            .Where(t => t.Status is QueueTicketStatus.Called or QueueTicketStatus.Serving)
            .OrderByDescending(t => t.CalledAt)
            .FirstOrDefault();

    /// <summary>
    /// Median called→completed of the counter's real visits finished today, or
    /// null until there are enough of them. The median, not the average, so one
    /// number left "being seen" for hours does not inflate every estimate.
    /// </summary>
    private double? ActualMinutesPerPatient(Guid counterId)
    {
        var durations = _byCounter[counterId]
            .Where(t => t.Status == QueueTicketStatus.Completed && t.CalledAt.HasValue && t.CompletedAt.HasValue)
            .Select(t => (t.CompletedAt!.Value - t.CalledAt!.Value).TotalMinutes)
            .Where(m => m >= MinVisitMinutes)
            .Order()
            .ToList();

        if (durations.Count < MinVisitSamples)
        {
            return null;
        }

        var middle = durations.Count / 2;
        var median = durations.Count % 2 == 1 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
        return Math.Round(median, 1);
    }

    private int EffectiveMinutesPerPatient(ServiceCounter counter) =>
        ActualMinutesPerPatient(counter.Id) is { } actual
            ? Math.Max(1, (int)Math.Round(actual))
            : counter.MinutesPerPatient;

    /// <summary>
    /// When the counter calls its next number: once the patient being seen has
    /// had their visit; now if nobody is being seen or that visit has run over.
    /// </summary>
    private DateTimeOffset FirstCallAt(CounterTicketRow? current, TimeSpan step) =>
        current?.CalledAt is { } calledAt && calledAt + step > _now ? calledAt + step : _now;

    /// <summary>Whole minutes from now until <paramref name="at"/>, rounded up; 0 when already due.</summary>
    private int MinutesUntil(DateTimeOffset at) =>
        Math.Max(0, (int)Math.Ceiling((at - _now).TotalMinutes));

    private int WaitedMinutes(CounterTicketRow row) =>
        Math.Max(0, (int)(_now.UtcDateTime - AsUtc(row.CreationTime)).TotalMinutes);

    private static bool IsInQueue(CounterTicketRow row) =>
        row.Status is QueueTicketStatus.Waiting or QueueTicketStatus.Called or QueueTicketStatus.Serving;

    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static BoardTicketDto ToBoardTicket(CounterTicketRow row) => new()
    {
        Id = row.Id,
        DisplayNumber = row.DisplayNumber,
        Status = row.Status,
        Priority = row.Priority,
        ServiceType = row.ServiceType,
        CalledAt = row.CalledAt,
    };
}
