using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Appointments;

/// <summary>
/// A recurring booking ("Lặp lại lịch hẹn"): the rule it was created with.
/// Its sessions are ordinary <see cref="Appointment"/>s carrying its id; each
/// one is moved, cancelled or finished on its own. The rule itself is kept
/// for display and is never edited after creation.
/// </summary>
public class AppointmentSeries : FullAuditedAggregateRoot<Guid>
{
    public Guid BranchId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public RecurrenceFrequency Frequency { get; private set; }
    public int Interval { get; private set; }

    /// <summary>ISO weekdays (1 = Monday … 7 = Sunday), comma separated; empty unless weekly.</summary>
    public string WeekDays { get; private set; } = "";

    public RecurrenceEnd End { get; private set; }
    public int? Count { get; private set; }
    public DateOnly? Until { get; private set; }

    protected AppointmentSeries() { }

    public AppointmentSeries(
        Guid id,
        Guid branchId,
        Guid patientId,
        Guid dentistId,
        AppointmentRecurrence rule)
        : base(id)
    {
        BranchId = branchId;
        PatientId = patientId;
        DentistId = dentistId;
        Frequency = rule.Frequency;
        Interval = rule.Interval;
        WeekDays = string.Join(',', rule.WeekDays);
        End = rule.End;
        Count = rule.Count;
        Until = rule.Until;
    }

    public AppointmentRecurrence Rule => new(Frequency, Interval, ParseWeekDays(WeekDays), End, Count, Until);

    private static IEnumerable<int> ParseWeekDays(string value) =>
        value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse);
}
