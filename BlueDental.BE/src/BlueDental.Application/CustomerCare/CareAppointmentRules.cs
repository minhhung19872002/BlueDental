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
        type is CareType.AppointmentReminder or CareType.MissedAppointment or CareType.CancelledAppointment;

    /// <summary>
    /// Nhắc lịch hẹn: bookings still to come — not yet <see cref="MissedAfter"/>
    /// past their time — and not yet arrived (Đã hẹn / Đã xác nhận), the only
    /// ones a reminder call is for (bug list item 12: the tab listed finished,
    /// in-chair and past bookings).
    /// Đặt lịch không đến: bookings whose time is <see cref="MissedAfter"/>
    /// behind <paramref name="now"/> and that never checked in. The two tabs
    /// split an un-arrived booking at that same moment, so none is in both.
    /// Lịch hẹn hủy: bookings cancelled within the window (bug list #16) —
    /// windowed by when they were cancelled, since that is when the patient
    /// needs a call, not by the slot they gave up.
    /// </summary>
    public static IQueryable<Appointment> Matching(
        IQueryable<Appointment> query,
        CareType type,
        DateTimeOffset? from,
        DateTimeOffset? to,
        DateTimeOffset now)
    {
        // Npgsql requires UTC offset for timestamptz parameters.
        var start = from?.ToUniversalTime();
        var end = to?.ToUniversalTime();

        if (type == CareType.CancelledAppointment)
        {
            query = query.Where(a => a.Status == AppointmentStatus.Cancelled && a.CancelledAt.HasValue);
            if (start.HasValue)
                query = query.Where(a => a.CancelledAt >= start.Value);
            if (end.HasValue)
                query = query.Where(a => a.CancelledAt <= end.Value);
            return query;
        }

        if (start.HasValue)
            query = query.Where(a => a.Slot.Start >= start.Value);
        if (end.HasValue)
            query = query.Where(a => a.Slot.Start <= end.Value);

        if (type == CareType.MissedAppointment)
        {
            var overdue = now.ToUniversalTime() - MissedAfter;
            return query.Where(a => a.Slot.Start <= overdue
                && (a.Status == AppointmentStatus.Requested
                    || a.Status == AppointmentStatus.Confirmed
                    || a.Status == AppointmentStatus.NoShow));
        }

        var dueFrom = now.ToUniversalTime() - MissedAfter;
        return query.Where(a => a.Slot.Start > dueFrom
            && (a.Status == AppointmentStatus.Requested
                || a.Status == AppointmentStatus.Confirmed));
    }

    /// <summary>The task subject each appointment-driven tab files its rows under.</summary>
    public static string SubjectOf(CareType type) => type switch
    {
        CareType.MissedAppointment => "Đặt lịch không đến",
        CareType.CancelledAppointment => "Lịch hẹn hủy",
        _ => "Nhắc lịch hẹn",
    };
}
