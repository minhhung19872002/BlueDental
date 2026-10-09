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

/// <summary>
/// Every 2 minutes: numbers left over from an earlier clinic day expire (the
/// queue starts clean after 00:00 Vietnam time), and each branch is told how
/// many numbers are nearing or past their counter's wait threshold.
/// </summary>
public class QueueWaitingTimeWorker : AsyncPeriodicBackgroundWorkerBase
{
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
        var counterRepository = workerContext.ServiceProvider
            .GetRequiredService<IRepository<ServiceCounter, Guid>>();
        var notifier = workerContext.ServiceProvider
            .GetRequiredService<IQueueNotifier>();

        var now = DateTime.UtcNow;
        var today = ClinicCalendar.DateOf(DateTimeOffset.UtcNow);

        await ExpireEarlierDaysAsync(repository, notifier, today);

        var waitingTickets = (await repository.GetQueryableAsync())
            .Where(x => x.QueueDate == today && x.Status == QueueTicketStatus.Waiting)
            .Select(x => new { x.ClinicBranchId, x.CounterId, x.CreationTime })
            .ToList();
        if (waitingTickets.Count == 0)
        {
            return;
        }

        var thresholds = (await counterRepository.GetQueryableAsync())
            .Select(c => new { c.Id, c.WaitWarningMinutes })
            .ToDictionary(c => c.Id, c => c.WaitWarningMinutes);

        var grouped = waitingTickets.GroupBy(x => x.ClinicBranchId).ToList();
        foreach (var group in grouped)
        {
            var levels = group
                .Select(t => QueueWaitLevels.Of(
                    (now - DateTime.SpecifyKind(t.CreationTime, DateTimeKind.Utc)).TotalMinutes,
                    t.CounterId is { } id && thresholds.TryGetValue(id, out var limit)
                        ? limit
                        : ServiceCounter.DefaultWaitWarningMinutes))
                .ToList();
            var warningCount = levels.Count(l => l == QueueWaitLevel.Warning);
            var dangerCount = levels.Count(l => l == QueueWaitLevel.Danger);

            if (warningCount > 0 || dangerCount > 0)
            {
                await notifier.NotifyWaitingTimeWarningAsync(group.Key, warningCount, dangerCount);
            }
        }

        Logger.LogDebug(
            "QueueWaitingTimeWorker: checked {Count} waiting ticket(s) across {Branches} branch(es).",
            waitingTickets.Count, grouped.Count);
    }

    private static async Task ExpireEarlierDaysAsync(
        IRepository<QueueTicket, Guid> repository, IQueueNotifier notifier, DateOnly today)
    {
        var leftovers = (await repository.GetQueryableAsync())
            .Where(x => x.QueueDate < today
                && (x.Status == QueueTicketStatus.Waiting
                    || x.Status == QueueTicketStatus.Called
                    || x.Status == QueueTicketStatus.Serving))
            .ToList();
        if (leftovers.Count == 0)
        {
            return;
        }

        foreach (var ticket in leftovers)
        {
            ticket.Expire();
        }
        await repository.UpdateManyAsync(leftovers, autoSave: true);

        foreach (var branchId in leftovers.Select(t => t.ClinicBranchId).Distinct())
        {
            await notifier.NotifyQueueUpdatedAsync(branchId);
        }
    }
}
