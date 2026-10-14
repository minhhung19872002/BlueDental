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
        : this(start, end, allowPast: false)
    {
    }

    private AppointmentSlot(DateTimeOffset start, DateTimeOffset end, bool allowPast)
    {
        if (start >= end)
        {
            throw new BusinessException(
                "BlueDental:Appointment:InvalidSlot",
                "Appointment end time must be after start time.");
        }

        var nowMinute = new DateTimeOffset(
            DateTimeOffset.UtcNow.Year, DateTimeOffset.UtcNow.Month, DateTimeOffset.UtcNow.Day,
            DateTimeOffset.UtcNow.Hour, DateTimeOffset.UtcNow.Minute, 0, TimeSpan.Zero);
        if (!allowPast && start < nowMinute)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.SlotInThePast);
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

    /// <summary>
    /// A slot moved in from the clinic's old system (F-61): it may lie in the
    /// past, which a new booking may not; the other rules still hold.
    /// </summary>
    public static AppointmentSlot Imported(DateTimeOffset start, DateTimeOffset end) =>
        new(start, end, allowPast: true);

    public bool OverlapsWith(AppointmentSlot other)
    {
        return Start < other.End && End > other.Start;
    }

    public override string ToString() =>
        $"{Start:yyyy-MM-dd HH:mm} – {End:HH:mm} ({DurationMinutes} min)";

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return Start;
        yield return End;
    }
}
