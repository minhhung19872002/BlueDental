using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Queue;

public class QueueWaitingTimeWorker : AsyncPeriodicBackgroundWorkerBase
{
    private const int ThresholdMinutes = 30;

    public QueueWaitingTimeWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 2 * 60 * 1000; // every 2 minutes
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var repository = workerContext.ServiceProvider
            .GetRequiredService<IRepository<QueueTicket, Guid>>();
        var notifier = workerContext.ServiceProvider
            .GetRequiredService<IQueueNotifier>();

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);

        var query = await repository.GetQueryableAsync();
        var waitingTickets = query
            .Where(x => x.QueueDate == today && x.Status == QueueTicketStatus.Waiting)
            .Select(x => new { x.ClinicBranchId, x.CreationTime })
            .ToList();

        var grouped = waitingTickets.GroupBy(x => x.ClinicBranchId);
        foreach (var group in grouped)
        {
            var warningCount = 0;
            var dangerCount = 0;
            foreach (var ticket in group)
            {
                var elapsed = (now - ticket.CreationTime).TotalMinutes;
                if (elapsed >= ThresholdMinutes * 2)
                    dangerCount++;
                else if (elapsed >= ThresholdMinutes)
                    warningCount++;
            }

            if (warningCount > 0 || dangerCount > 0)
            {
                await notifier.NotifyWaitingTimeWarningAsync(
                    group.Key, warningCount, dangerCount);
            }
        }

        if (waitingTickets.Count > 0)
        {
            Logger.LogDebug(
                "QueueWaitingTimeWorker: checked {Count} waiting ticket(s) across {Branches} branch(es).",
                waitingTickets.Count, grouped.Count());
        }
    }
}
