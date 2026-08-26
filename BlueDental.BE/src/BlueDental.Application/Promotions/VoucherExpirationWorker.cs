using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Promotions;

public class VoucherExpirationWorker : AsyncPeriodicBackgroundWorkerBase
{
    public VoucherExpirationWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 60 * 60 * 1000; // every hour
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var repository = workerContext.ServiceProvider
            .GetRequiredService<IRepository<Voucher, Guid>>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = await repository.GetQueryableAsync();
        var outdated = query
            .Where(x => x.Status == VoucherStatus.Active && x.ValidTo < today)
            .ToList();

        foreach (var voucher in outdated)
        {
            voucher.Expire();
            await repository.UpdateAsync(voucher);
        }

        if (outdated.Count > 0)
        {
            Logger.LogInformation("VoucherExpirationWorker: expired {Count} voucher(s).", outdated.Count);
        }
    }
}
