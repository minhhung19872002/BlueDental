using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.Zalo;

/// <summary>
/// Renews OA access tokens before they lapse, so a branch that sends nothing
/// for a day still has a live link the next morning. Runs every 30 minutes;
/// a connection is due when its access token has under two hours left.
/// </summary>
public class ZaloTokenRefreshWorker : AsyncPeriodicBackgroundWorkerBase
{
    public ZaloTokenRefreshWorker(AbpAsyncTimer timer, IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 30 * 60 * 1000;
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var connections = workerContext.ServiceProvider.GetRequiredService<IRepository<ZaloOaConnection, Guid>>();
        var tokens = workerContext.ServiceProvider.GetRequiredService<ZaloOaTokenService>();
        var clock = workerContext.ServiceProvider.GetRequiredService<IClock>();
        var logger = workerContext.ServiceProvider.GetRequiredService<ILogger<ZaloTokenRefreshWorker>>();

        var threshold = clock.Now.Add(ZaloOaConnection.RefreshLeeway);
        var due = (await connections.GetQueryableAsync())
            .Where(c => c.Status == ZaloOaConnectionStatus.Active && c.AccessTokenExpiresAt <= threshold)
            .ToList();

        foreach (var connection in due)
        {
            try
            {
                await tokens.RefreshAsync(connection);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Zalo OA token refresh crashed for branch {BranchId}", connection.ClinicBranchId);
            }
        }
    }
}
