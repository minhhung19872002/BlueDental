using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;

namespace BlueDental.Data;

/// <summary>
/// Writes the patients, treatment history, payments and bookings planned by the old-system import
/// (F-61). Thousands of new aggregates in one change tracker make every save
/// slower than the last, so the writer flushes them a few hundred patients at
/// a time. All batches share the caller's unit of work and its transaction:
/// the import still lands whole or not at all.
/// </summary>
public interface IMigratedHistoryWriter
{
    Task WriteAsync(
        IReadOnlyList<Patient> patients,
        IReadOnlyList<TreatmentPlan> plans,
        IReadOnlyList<TreatmentStage> stages,
        IReadOnlyList<PatientPayment> payments,
        IReadOnlyList<Appointment> appointments,
        CancellationToken cancellationToken = default);
}
