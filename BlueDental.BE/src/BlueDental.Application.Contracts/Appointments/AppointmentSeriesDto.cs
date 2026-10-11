using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Appointments;

/// <summary>The "Lặp lại lịch hẹn" rule, counted from the booking's own date.</summary>
public class AppointmentRecurrenceDto
{
    public RecurrenceFrequency Frequency { get; set; }

    /// <summary>"Mỗi N ngày / tuần / tháng"; 1 for the three preset options.</summary>
    public int Interval { get; set; } = 1;

    /// <summary>ISO weekdays (1 = Monday … 7 = Sunday) of a weekly rule; the booking's own weekday is always included.</summary>
    public List<int> WeekDays { get; set; } = [];

    public RecurrenceEnd End { get; set; }

    /// <summary>"Sau N lần", when <see cref="End"/> is AfterCount.</summary>
    public int? Count { get; set; }

    /// <summary>"Đến ngày", when <see cref="End"/> is OnDate.</summary>
    public DateOnly? Until { get; set; }
}

/// <summary>What the dialog knows before saving: who, the first slot and the rule.</summary>
public class PreviewAppointmentSeriesInput
{
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }
    public AppointmentRecurrenceDto Recurrence { get; set; } = new();
}

/// <summary>A normal booking plus the rule that repeats it; every session gets the same details.</summary>
public class CreateAppointmentSeriesDto : CreateAppointmentDto
{
    public AppointmentRecurrenceDto Recurrence { get; set; } = new();
}

/// <summary>One row of "Danh sách buổi hẹn".</summary>
public class AppointmentSeriesSessionDto
{
    /// <summary>1-based position in the series.</summary>
    public int Index { get; set; }

    public DateTimeOffset Start { get; set; }
    public DateTimeOffset End { get; set; }
    public SeriesOccurrenceState State { get; set; }

    /// <summary>Why the session is "Trùng lịch"; null otherwise.</summary>
    public SeriesConflictReason? ConflictReason { get; set; }

    /// <summary>The booked appointment; null on a preview.</summary>
    public Guid? AppointmentId { get; set; }

    /// <summary>
    /// Where "Đã hẹn tiếp" at reception moved a session the patient never came
    /// to — the follow-up's start; null otherwise.
    /// </summary>
    public DateTimeOffset? MovedTo { get; set; }
}

public class AppointmentSeriesDto
{
    /// <summary>Null on a preview.</summary>
    public Guid? Id { get; set; }

    public AppointmentRecurrenceDto Recurrence { get; set; } = new();
    public List<AppointmentSeriesSessionDto> Sessions { get; set; } = [];
}

public interface IAppointmentSeriesAppService : IApplicationService
{
    /// <summary>The sessions the rule lays out and which of them clash; nothing is booked.</summary>
    Task<AppointmentSeriesDto> PreviewAsync(PreviewAppointmentSeriesInput input);

    /// <summary>Books every session, or none when any one clashes (Appointment:0012).</summary>
    Task<AppointmentSeriesDto> CreateAsync(CreateAppointmentSeriesDto input);

    /// <summary>The series an appointment belongs to, with each session as it stands now.</summary>
    Task<AppointmentSeriesDto> GetByAppointmentAsync(Guid appointmentId);
}
