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
/// <see cref="Windows"/> the dentist is not registered off on the Lịch nghỉ board —
/// both shifts, one on nghỉ sáng / nghỉ chiều, none on nghỉ cả ngày. A booking
/// running into the time off is refused (Appointment:0009/0019/0020, R-1210).
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
