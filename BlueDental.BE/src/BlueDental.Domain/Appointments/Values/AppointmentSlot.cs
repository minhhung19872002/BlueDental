using System;
using Volo.Abp;
using Volo.Abp.Domain.Values;

namespace BlueDental.Appointments.Values;

/// <summary>
/// Value object representing a time slot for a dental appointment.
/// </summary>
public class AppointmentSlot : ValueObject
{
    public DateTimeOffset Start { get; }
    public DateTimeOffset End { get; }
    public int DurationMinutes => (int)(End - Start).TotalMinutes;

    protected AppointmentSlot() { }

    public AppointmentSlot(DateTimeOffset start, DateTimeOffset end)
    {
        if (start >= end)
        {
            throw new BusinessException(
                "BlueDental:Appointment:InvalidSlot",
                "Appointment end time must be after start time.");
        }

        if (DurationMinutes > 480)
        {
            throw new BusinessException(
                "BlueDental:Appointment:SlotTooLong",
                "A single appointment slot cannot exceed 8 hours.");
        }

        Start = start;
        End = end;
    }

    public bool OverlapsWith(AppointmentSlot other)
    {
        return Start < other.End && End > other.Start;
    }

    public override string ToString() =>
        $"{Start:yyyy-MM-dd HH:mm} – {End:HH:mm} ({DurationMinutes} min)";

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return Start;
        yield return End;
    }
}
