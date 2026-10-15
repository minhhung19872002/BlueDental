using System;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// "Ngày điều trị" — the day a công đoạn or tái khám was worked, picked by the
/// doctor (BA, 2026-10-09). It is never after today. Any earlier day is fine,
/// even one before the phiếu điều trị was opened (owner, R-951, 2026-10-15 —
/// reverses QA #32): old work is entered on slips opened later.
/// </summary>
public static class TreatmentDateRule
{
    /// <summary>The day to store: <paramref name="treatmentDate"/>, or today when none was sent.</summary>
    public static DateOnly Resolve(DateOnly? treatmentDate)
    {
        var today = ClinicCalendar.DateOf(DateTimeOffset.UtcNow);
        var day = treatmentDate ?? today;

        if (day > today)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageTreatmentDateInFuture,
                "A treatment date cannot be after today.");
        }

        return day;
    }
}
