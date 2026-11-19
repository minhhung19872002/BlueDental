using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Threading;

namespace BlueDental.Security;

/// <summary>
/// Runs <see cref="SecretCipherUpgrader"/> once at start-up and every six hours
/// after, so a value saved in the old format while the key was missing is
/// picked up too. With nothing left to rewrite a run is two small reads.
/// </summary>
public class SecretCipherUpgradeWorker : AsyncPeriodicBackgroundWorkerBase
{
    private static readonly TimeSpan RunEvery = TimeSpan.FromHours(6);

    public SecretCipherUpgradeWorker(AbpAsyncTimer timer, IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = (int)RunEvery.TotalMilliseconds;
        Timer.RunOnStart = true;
    }

    protected override Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext) =>
        workerContext.ServiceProvider.GetRequiredService<SecretCipherUpgrader>().UpgradeAsync();
}
