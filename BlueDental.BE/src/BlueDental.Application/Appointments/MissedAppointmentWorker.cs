using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Appointments;

/// <summary>
/// Runs every minute so a booking turns Trễ hẹn soon after its time is over,
/// on every screen at once. See <see cref="MissedAppointmentMarker"/>.
/// </summary>
public class MissedAppointmentWorker : AsyncPeriodicBackgroundWorkerBase
{
    public MissedAppointmentWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 60 * 1000; // every minute
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var marker = workerContext.ServiceProvider.GetRequiredService<MissedAppointmentMarker>();
        var count = await marker.MarkAsync(DateTimeOffset.UtcNow);

        if (count > 0)
        {
            Logger.LogInformation("MissedAppointmentWorker: moved {Count} appointment(s) to NoShow.", count);
        }
    }
}
