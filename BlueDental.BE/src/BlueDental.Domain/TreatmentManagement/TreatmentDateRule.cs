using System;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// "Ngày điều trị" — the day a công đoạn or tái khám was worked, picked by the
/// doctor (BA, 2026-10-09). It is never after today, and never before the
/// phiếu điều trị it belongs to was opened (QA #32, 2026-10-12).
/// </summary>
public static class TreatmentDateRule
{
    /// <summary>
    /// The day to store: <paramref name="treatmentDate"/>, or today when none
    /// was sent. <paramref name="slipOpenedOn"/> is the clinic day the slip was
    /// created; null skips that bound (imported history, a row with no slip).
    /// </summary>
    public static DateOnly Resolve(DateOnly? treatmentDate, DateOnly? slipOpenedOn)
    {
        var today = ClinicCalendar.DateOf(DateTimeOffset.UtcNow);
        var day = treatmentDate ?? today;

        if (day > today)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageTreatmentDateInFuture,
                "A treatment date cannot be after today.");
        }

        if (slipOpenedOn.HasValue && day < slipOpenedOn.Value)
        {
            throw new BusinessException(
                    BlueDentalDomainErrorCodes.TreatmentManagement.StageTreatmentDateBeforeSlip,
                    "A treatment date cannot be before the treatment plan was opened.")
                .WithData("date", slipOpenedOn.Value.ToString("dd/MM/yyyy"));
        }

        return day;
    }
}
