using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.TreatmentManagement;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.CustomerCare;

/// <summary>
/// End-of-day worker that scans yesterday's completed appointments and creates
/// a <see cref="CareType.NoService"/> care record for each patient who left
/// without a treatment plan being created.
///
/// Runs every hour; only processes appointments whose date is strictly before
/// today (UTC) so the dentist has time to create the plan during the visit.
/// Idempotent: skips patients who already have a NoService record for the
/// same appointment.
/// </summary>
public class NoServiceCareWorker : AsyncPeriodicBackgroundWorkerBase
{
    public NoServiceCareWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 60 * 60 * 1000; // every hour
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var appointmentRepo = workerContext.ServiceProvider
            .GetRequiredService<IRepository<Appointment, Guid>>();
        var planRepo = workerContext.ServiceProvider
            .GetRequiredService<IRepository<TreatmentPlan, Guid>>();
        var careRepo = workerContext.ServiceProvider
            .GetRequiredService<IRepository<CareRecord, Guid>>();
        var guidGenerator = workerContext.ServiceProvider
            .GetRequiredService<IGuidGenerator>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var yesterday = today.AddDays(-1);
        var windowStart = yesterday.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var windowEnd = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var appointmentQuery = await appointmentRepo.GetQueryableAsync();
        var completedYesterday = appointmentQuery
            .Where(a => a.Status == AppointmentStatus.Completed)
            .Where(a => a.CompletedAt >= new DateTimeOffset(windowStart)
                     && a.CompletedAt < new DateTimeOffset(windowEnd))
            .Select(a => new { a.Id, a.PatientId, a.DentistId, a.BranchId, a.CompletedAt })
            .ToList();

        if (completedYesterday.Count == 0) return;

        var patientIds = completedYesterday.Select(a => a.PatientId).Distinct().ToList();

        var planQuery = await planRepo.GetQueryableAsync();
        var patientsWithPlans = planQuery
            .Where(p => patientIds.Contains(p.PatientId))
            .Where(p => p.Status != TreatmentPlanStatus.Cancelled)
            .Where(p => p.CreationTime >= windowStart && p.CreationTime < windowEnd)
            .Select(p => p.PatientId)
            .Distinct()
            .ToHashSet();

        var careQuery = await careRepo.GetQueryableAsync();
        var existingAppointmentIds = careQuery
            .Where(c => c.Type == CareType.NoService && c.AppointmentId != null)
            .Where(c => completedYesterday.Select(a => a.Id).Contains(c.AppointmentId!.Value))
            .Select(c => c.AppointmentId!.Value)
            .ToHashSet();

        var created = 0;
        foreach (var appt in completedYesterday)
        {
            if (patientsWithPlans.Contains(appt.PatientId))
                continue;
            if (existingAppointmentIds.Contains(appt.Id))
                continue;

            var record = new CareRecord(
                guidGenerator.Create(),
                appt.PatientId,
                appt.BranchId,
                CareType.NoService,
                "Không làm dịch vụ",
                assignedStaffId: appt.DentistId,
                dueAt: appt.CompletedAt,
                appointmentId: appt.Id);

            await careRepo.InsertAsync(record, autoSave: true);
            created++;
        }

        if (created > 0)
        {
            Logger.LogInformation(
                "NoServiceCareWorker: created {Count} care record(s) for {Date}.",
                created, yesterday);
        }
    }
}
