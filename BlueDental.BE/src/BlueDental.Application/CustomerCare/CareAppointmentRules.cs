using System;
using System.Linq;
using BlueDental.Appointments;

namespace BlueDental.CustomerCare;

/// <summary>
/// Which appointments the appointment-driven CSKH tabs list (owner, 2026-10-05).
/// Read live from the appointment, so a moved, cancelled or late-arrived
/// appointment leaves or joins the tab without touching its care task.
/// </summary>
public static class CareAppointmentRules
{
    /// <summary>Đặt lịch không đến — this long past the booked time with no arrival.</summary>
    public static readonly TimeSpan MissedAfter = TimeSpan.FromMinutes(5);

    public static bool IsAppointmentDriven(CareType? type) =>
        type is CareType.AppointmentReminder or CareType.MissedAppointment;

    /// <summary>
    /// Nhắc lịch hẹn: every booking in the window that is still on the book.
    /// Đặt lịch không đến: bookings whose time is <see cref="MissedAfter"/>
    /// behind <paramref name="now"/> and that never checked in.
    /// </summary>
    public static IQueryable<Appointment> Matching(
        IQueryable<Appointment> query,
        CareType type,
        DateTimeOffset? from,
        DateTimeOffset? to,
        DateTimeOffset now)
    {
        // Npgsql requires UTC offset for timestamptz parameters.
        if (from.HasValue)
        {
            var start = from.Value.ToUniversalTime();
            query = query.Where(a => a.Slot.Start >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.ToUniversalTime();
            query = query.Where(a => a.Slot.Start <= end);
        }

        if (type == CareType.MissedAppointment)
        {
            var overdue = now.ToUniversalTime() - MissedAfter;
            return query.Where(a => a.Slot.Start <= overdue
                && (a.Status == AppointmentStatus.Requested
                    || a.Status == AppointmentStatus.Confirmed
                    || a.Status == AppointmentStatus.NoShow));
        }

        return query.Where(a => a.Status != AppointmentStatus.Cancelled);
    }
}
