using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;

namespace BlueDental.Appointments;

/// <summary>
/// The "Lặp lại lịch hẹn" rule of a recurring booking. Every session is
/// counted from the booking's own date (BA: "tất cả đều dựa vào ngày hẹn"):
/// it is always the first session, a weekly rule always includes its weekday
/// and a monthly rule repeats its day of the month, falling back to the last
/// day of a shorter month.
/// </summary>
public sealed record AppointmentRecurrence
{
    /// <summary>The most sessions one recurring booking may hold.</summary>
    public const int MaxSessions = 100;

    /// <summary>The largest "Mỗi N" the custom panel allows.</summary>
    public const int MaxInterval = 99;

    public RecurrenceFrequency Frequency { get; }
    public int Interval { get; }

    /// <summary>ISO weekdays (1 = Monday … 7 = Sunday) of a weekly rule; empty otherwise.</summary>
    public IReadOnlyList<int> WeekDays { get; }

    public RecurrenceEnd End { get; }
    public int? Count { get; }
    public DateOnly? Until { get; }

    public AppointmentRecurrence(
        RecurrenceFrequency frequency,
        int interval,
        IEnumerable<int>? weekDays,
        RecurrenceEnd end,
        int? count,
        DateOnly? until)
    {
        if (!Enum.IsDefined(frequency) || !Enum.IsDefined(end) || interval < 1 || interval > MaxInterval)
        {
            throw Invalid();
        }

        var days = (weekDays ?? []).Distinct().Order().ToList();
        if (days.Any(d => d < 1 || d > 7))
        {
            throw Invalid();
        }

        switch (end)
        {
            case RecurrenceEnd.AfterCount when count is null or < 1:
            case RecurrenceEnd.OnDate when until is null:
                throw Invalid();
            case RecurrenceEnd.AfterCount when count > MaxSessions:
                throw TooLong();
        }

        Frequency = frequency;
        Interval = interval;
        WeekDays = frequency == RecurrenceFrequency.Weekly ? days : [];
        End = end;
        Count = end == RecurrenceEnd.AfterCount ? count : null;
        Until = end == RecurrenceEnd.OnDate ? until : null;
    }

    /// <summary>The ISO weekday (1 = Monday … 7 = Sunday) of a date.</summary>
    public static int IsoWeekDay(DateOnly date) => date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;

    /// <summary>
    /// The session dates, <paramref name="first"/> included as the first one.
    /// Refused when an end date comes before the first session or lets the
    /// series run past <see cref="MaxSessions"/>.
    /// </summary>
    public IReadOnlyList<DateOnly> DatesFrom(DateOnly first)
    {
        if (End == RecurrenceEnd.OnDate && Until < first)
        {
            throw Invalid();
        }

        var dates = new List<DateOnly>();
        foreach (var date in Candidates(first))
        {
            if (End == RecurrenceEnd.AfterCount && dates.Count == Count) break;
            if (End == RecurrenceEnd.OnDate && date > Until) break;
            if (dates.Count == MaxSessions) throw TooLong();
            dates.Add(date);
        }

        return dates;
    }

    /// <summary>Every date the rule produces from <paramref name="first"/> on, in order.</summary>
    private IEnumerable<DateOnly> Candidates(DateOnly first)
    {
        switch (Frequency)
        {
            case RecurrenceFrequency.Daily:
                for (var k = 0; ; k++) yield return first.AddDays(k * Interval);

            case RecurrenceFrequency.Monthly:
                // Always counted from the first date, so 31 Jan → 28 Feb → 31 Mar
                // rather than drifting to the 28th for good.
                for (var k = 0; ; k++) yield return first.AddMonths(k * Interval);

            default:
                var days = WeekDays.Append(IsoWeekDay(first)).Distinct().Order().ToList();
                var monday = first.AddDays(1 - IsoWeekDay(first));
                for (var week = 0; ; week += Interval)
                {
                    foreach (var day in days)
                    {
                        var date = monday.AddDays(week * 7 + day - 1);
                        if (date >= first) yield return date;
                    }
                }
        }
    }

    private static BusinessException Invalid() =>
        new(BlueDentalDomainErrorCodes.Appointments.InvalidRecurrence);

    private static BusinessException TooLong() =>
        new BusinessException(BlueDentalDomainErrorCodes.Appointments.SeriesTooLong)
            .WithData("Max", MaxSessions);
}
