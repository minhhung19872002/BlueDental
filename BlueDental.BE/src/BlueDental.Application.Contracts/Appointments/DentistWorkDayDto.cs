using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.Appointments;

/// <summary>One stretch of a dentist's working hours, on the clinic's wall clock.</summary>
public class ShiftWindowDto
{
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
}

/// <summary>
/// One day of a dentist's Lịch làm việc for "Chọn lịch hẹn tiếp theo": the
/// planned morning and afternoon the timeline is drawn over, and the
/// <see cref="Windows"/> a follow-up may be booked in — the shifts less any
/// leave, empty on a day off. A booking outside them is refused (Appointment:0008/0009).
/// </summary>
public class DentistWorkDayDto
{
    public DateOnly Date { get; set; }
    public ShiftWindowDto Morning { get; set; } = default!;
    public ShiftWindowDto Afternoon { get; set; } = default!;
    public List<ShiftWindowDto> Windows { get; set; } = [];
}

public class GetDentistWorkDaysInput : IValidatableObject
{
    /// <summary>A two-month view is the most the picker asks for.</summary>
    public const int MaxDays = 62;

    public Guid DentistId { get; set; }

    /// <summary>Inclusive range.</summary>
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (DentistId == Guid.Empty)
        {
            yield return new ValidationResult("A dentist is required.", [nameof(DentistId)]);
        }

        if (ToDate < FromDate || ToDate.DayNumber - FromDate.DayNumber >= MaxDays)
        {
            yield return new ValidationResult(
                $"The range must run forwards and span at most {MaxDays} days.", [nameof(ToDate)]);
        }
    }
}
