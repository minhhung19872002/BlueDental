using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Threading;

namespace BlueDental.EInvoicing;

/// <summary>
/// EasyInvoice has no webhook, so BlueDental polls (owner 2026-11-18): each
/// minute the invoices waiting to be signed, each hour also the signed ones of
/// the last <see cref="ElectronicInvoiceSync.CancelWindowDays"/> days, for a
/// cancel. Open screens hear the result over SignalR.
/// </summary>
public class EInvoiceSyncWorker : AsyncPeriodicBackgroundWorkerBase
{
    private static readonly TimeSpan SignedCheckEvery = TimeSpan.FromHours(1);

    private DateTimeOffset _lastSignedCheck = DateTimeOffset.MinValue;

    public EInvoiceSyncWorker(AbpAsyncTimer timer, IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 60_000;
    }

    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var now = DateTimeOffset.UtcNow;
        var includeSigned = now - _lastSignedCheck >= SignedCheckEvery;
        await workerContext.ServiceProvider.GetRequiredService<ElectronicInvoiceSync>().SweepAsync(includeSigned, now);
        if (includeSigned)
        {
            _lastSignedCheck = now;
        }
    }
}
