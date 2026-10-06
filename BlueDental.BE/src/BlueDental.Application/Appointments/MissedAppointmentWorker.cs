using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Appointments;

/// <summary>
/// Runs every 15 seconds so a booking turns Trễ hẹn right as its time passes,
/// then tells open screens to refetch — no reload needed. See
/// <see cref="MissedAppointmentMarker"/>.
/// </summary>
public class MissedAppointmentWorker : AsyncPeriodicBackgroundWorkerBase
{
    public MissedAppointmentWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 15 * 1000; // every 15 seconds
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var marker = workerContext.ServiceProvider.GetRequiredService<MissedAppointmentMarker>();
        var branchIds = await marker.MarkAsync(DateTimeOffset.UtcNow);
        if (branchIds.Count == 0) return;

        // After the commit, so a screen that refetches on the message sees the change.
        var unitOfWork = workerContext.ServiceProvider.GetRequiredService<IUnitOfWorkManager>().Current;
        var notifier = workerContext.ServiceProvider.GetRequiredService<IAppointmentNotifier>();
        if (unitOfWork is null)
        {
            await notifier.NotifyAppointmentsChangedAsync(branchIds);
        }
        else
        {
            unitOfWork.OnCompleted(() => notifier.NotifyAppointmentsChangedAsync(branchIds));
        }

        Logger.LogInformation("MissedAppointmentWorker: moved appointments of {Count} branch(es) to NoShow.", branchIds.Count);
    }
}
