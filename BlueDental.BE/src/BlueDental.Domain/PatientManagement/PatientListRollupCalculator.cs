using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.TreatmentManagement;
using Volo.Abp.Domain.Services;

namespace BlueDental.PatientManagement;

/// <summary>
/// What one row of the patient list says about a patient, beyond the record
/// itself: the treatment state, who and what is on the slips, the money and the
/// two dates.
/// </summary>
/// <param name="TreatmentStatus">Trạng thái.</param>
/// <param name="ServiceCatalogIds">Dịch vụ, as catalog ids for the caller to name.</param>
/// <param name="DentistIds">Bác sĩ, as staff ids for the caller to name.</param>
/// <param name="TotalAmount">Số tiền.</param>
/// <param name="TotalRevenue">Thực thu.</param>
/// <param name="TotalDebt">Công nợ.</param>
/// <param name="NextAppointmentAt">Lịch hẹn gần nhất.</param>
/// <param name="LastVisitAt">Lần khám cuối.</param>
public sealed record PatientRollup(
    PatientTreatmentStatus TreatmentStatus,
    IReadOnlyList<Guid> ServiceCatalogIds,
    IReadOnlyList<Guid> DentistIds,
    decimal TotalAmount,
    decimal TotalRevenue,
    decimal TotalDebt,
    DateTimeOffset? NextAppointmentAt,
    DateTimeOffset? LastVisitAt);

/// <summary>
/// Builds the patient list's per-row rollup.
///
/// Stateless and repository-free, as domain services here are: the app service
/// loads one page of patients and the slips, payments and appointments that
/// belong to them, then asks this to fold them into rows.
///
/// The treatment state is derived on every read, never stored — the reference
/// recomputes its own <c>patientSummary.treatmentStatus</c> the same way, and a
/// stored copy would only be a second thing to keep in step.
/// </summary>
public class PatientListRollupCalculator : IDomainService
{
    private readonly PatientMoneyCalculator _money;

    public PatientListRollupCalculator(PatientMoneyCalculator money)
    {
        _money = money;
    }

    public PatientRollup For(
        Patient patient,
        IReadOnlyCollection<TreatmentPlan> plans,
        IReadOnlyCollection<PatientPayment> payments,
        IReadOnlyCollection<Appointment> appointments,
        DateTimeOffset now)
    {
        var live = plans.Where(p => p.Status != TreatmentPlanStatus.Cancelled).ToList();
        var summary = _money.ForPatient(live, payments);

        return new PatientRollup(
            TreatmentStatus: StatusOf(live),
            ServiceCatalogIds: live
                .SelectMany(p => p.Services)
                .Where(s => s.Status != TreatmentServiceStatus.Cancelled)
                .Select(s => s.ServiceId)
                .Distinct()
                .ToList(),
            DentistIds: live.Select(p => p.DentistId).Distinct().ToList(),
            TotalAmount: summary.TotalPrice,
            TotalRevenue: summary.TotalPaid - summary.TotalRefund,
            // A patient who paid ahead is not in credit on this column; the
            // reference shows 0 there and keeps the surplus in Trả trước.
            TotalDebt: summary.TotalDue > 0m ? summary.TotalDue : 0m,
            NextAppointmentAt: NextAppointment(appointments, now),
            LastVisitAt: LastVisit(appointments) ?? patient.RegisteredAt);
    }

    /// <summary>
    /// Chưa phát sinh covers two states the reference keeps apart internally —
    /// no slip at all, and a slip nobody has started — and shows both the same
    /// way. Đang điều trị is any started work; Hoàn tất needs every line done.
    /// </summary>
    private static PatientTreatmentStatus StatusOf(IReadOnlyCollection<TreatmentPlan> plans)
    {
        if (plans.Count == 0)
        {
            return PatientTreatmentStatus.None;
        }

        var lines = plans
            .SelectMany(p => p.Services)
            .Where(s => s.Status != TreatmentServiceStatus.Cancelled)
            .ToList();

        if (lines.Count == 0)
        {
            return PatientTreatmentStatus.Created;
        }

        if (lines.TrueForAll(s => s.Status == TreatmentServiceStatus.Done))
        {
            return PatientTreatmentStatus.Done;
        }

        return lines.Exists(s => s.Status is TreatmentServiceStatus.InProgress or TreatmentServiceStatus.Done)
            ? PatientTreatmentStatus.InProgress
            : PatientTreatmentStatus.Created;
    }

    /// <summary>The soonest appointment still ahead that has not been called off.</summary>
    private static DateTimeOffset? NextAppointment(
        IReadOnlyCollection<Appointment> appointments,
        DateTimeOffset now)
    {
        var upcoming = appointments
            .Where(a => a.Status is not (AppointmentStatus.Cancelled or AppointmentStatus.NoShow or AppointmentStatus.Completed))
            .Select(a => a.Slot.Start)
            .Where(start => start >= now)
            .ToList();

        return upcoming.Count == 0 ? null : upcoming.Min();
    }

    /// <summary>The last visit the patient actually turned up for.</summary>
    private static DateTimeOffset? LastVisit(IReadOnlyCollection<Appointment> appointments)
    {
        var attended = appointments
            .Where(a => a.Status is AppointmentStatus.Completed or AppointmentStatus.CheckedIn or AppointmentStatus.InProgress)
            .Select(a => a.CompletedAt ?? a.CheckedInAt ?? a.Slot.Start)
            .ToList();

        return attended.Count == 0 ? null : attended.Max();
    }
}
