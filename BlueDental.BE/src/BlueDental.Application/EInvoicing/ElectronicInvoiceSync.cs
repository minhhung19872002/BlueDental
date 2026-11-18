using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.ClinicIntegration;
using BlueDental.Localization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;
using Volo.Abp.Uow;

namespace BlueDental.EInvoicing;

/// <summary>
/// Reads e-invoices back from EasyInvoice (BA 2026-11-18). The accountant signs
/// — or cancels — on the provider's portal, which tells nobody, so BlueDental
/// asks: every minute for the invoices waiting there (Chờ kiểm tra), every hour
/// for the signed ones of the last <see cref="CancelWindowDays"/> days, and
/// whenever someone presses ↻. What it hears is followed up here: a signed
/// invoice's PDF is stored, the YC-HD it answers is closed with its number (or
/// reopened when it is cancelled), and open screens are told to refetch.
///
/// Every call is logged in the integration call log, shape only.
/// </summary>
public class ElectronicInvoiceSync : ITransientDependency
{
    public const string ImportOperation = "einvoice-import";
    public const string LookupOperation = "einvoice-lookup";
    public const string PdfOperation = "einvoice-pdf";

    /// <summary>How far back a signed invoice is still checked for a cancel.</summary>
    public const int CancelWindowDays = 90;

    /// <summary>The provider's getInvoicesByIkeys takes a list; this many per call.</summary>
    public const int BatchSize = 50;

    /// <summary>A sweep reads at most this many invoices, so one slow minute cannot pile up.</summary>
    public const int MaxPerSweep = 2000;

    private readonly IRepository<ElectronicInvoice, Guid> _invoices;
    private readonly IRepository<InvoiceRequest, Guid> _requests;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IEasyInvoiceClient _provider;
    private readonly EasyInvoiceSettingsResolver _accounts;
    private readonly IBlobContainer _blobs;
    private readonly IUnitOfWorkManager _unitOfWorkManager;
    private readonly IAsyncQueryableExecuter _asyncExecuter;
    private readonly IGuidGenerator _guidGenerator;
    private readonly IStringLocalizer<BlueDentalResource> _localizer;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ElectronicInvoiceSync> _logger;

    public ElectronicInvoiceSync(
        IRepository<ElectronicInvoice, Guid> invoices,
        IRepository<InvoiceRequest, Guid> requests,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IEasyInvoiceClient provider,
        EasyInvoiceSettingsResolver accounts,
        IBlobContainer blobs,
        IUnitOfWorkManager unitOfWorkManager,
        IAsyncQueryableExecuter asyncExecuter,
        IGuidGenerator guidGenerator,
        IStringLocalizer<BlueDentalResource> localizer,
        IServiceProvider serviceProvider,
        ILogger<ElectronicInvoiceSync> logger)
    {
        _invoices = invoices;
        _requests = requests;
        _callLogs = callLogs;
        _provider = provider;
        _accounts = accounts;
        _blobs = blobs;
        _unitOfWorkManager = unitOfWorkManager;
        _asyncExecuter = asyncExecuter;
        _guidGenerator = guidGenerator;
        _localizer = localizer;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>Where a round's signed PDF is kept in the blob store.</summary>
    public static string PdfBlobNameOf(ElectronicInvoice invoice) => $"einvoices/{invoice.Id:N}-{invoice.Round}.pdf";

    /// <summary>
    /// Reads <paramref name="batch"/> — invoices of one branch filed under
    /// <paramref name="settings"/> — back from the provider and applies what it
    /// says. The rows are updated in the caller's unit of work.
    /// </summary>
    public async Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> RefreshAsync(
        EasyInvoiceSettings settings, IReadOnlyList<ElectronicInvoice> batch, DateTimeOffset now)
    {
        now = now.ToUniversalTime();
        var outcome = await _provider.GetByIkeysAsync(settings, batch.Select(i => i.Ikey).ToList());
        await LogAsync(batch[0].ClinicBranchId, LookupOperation, outcome, batch.Count);

        if (!outcome.Succeeded)
        {
            foreach (var invoice in batch)
            {
                invoice.RecordFailure(outcome.LogError, now);
            }

            await _invoices.UpdateManyAsync(batch);
            return outcome;
        }

        foreach (var invoice in batch)
        {
            var summary = outcome.Data?.FirstOrDefault(s =>
                string.Equals(s.Ikey, invoice.Ikey, StringComparison.OrdinalIgnoreCase));
            if (summary == null)
            {
                invoice.RecordFailure("The provider no longer lists this invoice.", now);
                continue;
            }

            await HeardAsync(settings, invoice, invoice.ApplyProviderSummary(summary, now), now);
        }

        await _invoices.UpdateManyAsync(batch);
        return outcome;
    }

    /// <summary>
    /// What follows a reading: the PDF of a signed invoice that has none yet,
    /// the YC-HD it answers, and a nudge to the branch's open screens.
    /// </summary>
    public async Task HeardAsync(
        EasyInvoiceSettings settings, ElectronicInvoice invoice, ElectronicInvoiceChange change, DateTimeOffset now)
    {
        if (invoice.IsSigned && invoice.PdfBlobName == null)
        {
            await StorePdfAsync(settings, invoice);
        }

        if (change == ElectronicInvoiceChange.None)
        {
            return;
        }

        var requests = await LinkedRequestsAsync(invoice);
        if (change == ElectronicInvoiceChange.Signed && invoice.No is { } no)
        {
            foreach (var request in requests.Where(r => r.CompleteFromProvider(no, now)))
            {
                await _requests.UpdateAsync(request);
            }
        }
        else if (change == ElectronicInvoiceChange.Cancelled
                 && (invoice.CurrentAttempt?.No ?? invoice.No) is { } cancelledNo)
        {
            var reason = _localizer["Treatment:EInvoice:CancelledOnProvider", cancelledNo].Value;
            // Only the requests this invoice closed: one finished by hand under
            // another number is the accountant's, not the sync's.
            foreach (var request in requests.Where(r => r.InvoiceNo == cancelledNo
                         && r.ReopenAfterProviderCancel(reason)))
            {
                await _requests.UpdateAsync(request);
            }
        }

        NotifyAfterCommit(invoice.ClinicBranchId);
    }

    /// <summary>Lưu sent the invoice: the YC-HD it answers is being worked (Đang xử lý).</summary>
    public async Task StartRequestsAsync(ElectronicInvoice invoice, Guid assigneeId)
    {
        foreach (var request in await LinkedRequestsAsync(invoice))
        {
            if (request.Status is InvoiceRequestStatus.Pending or InvoiceRequestStatus.NeedsInfo)
            {
                request.Start(assigneeId);
                await _requests.UpdateAsync(request);
            }
        }
    }

    /// <summary>
    /// One pass of the worker: every invoice waiting at the provider and, when
    /// <paramref name="includeSigned"/>, the recently signed ones. Each branch
    /// and account is read in its own unit of work, so one account that fails
    /// does not hold back the others. Returns how many invoices were asked about.
    /// </summary>
    public async Task<int> SweepAsync(bool includeSigned, DateTimeOffset now)
    {
        var targets = await SweepTargetsAsync(includeSigned, now);
        var groups = targets
            .GroupBy(t => (t.ProviderConfigId, t.ClinicBranchId))
            .SelectMany(g => g.Select(t => t.Id).Chunk(BatchSize));

        foreach (var ids in groups)
        {
            try
            {
                using var uow = _unitOfWorkManager.Begin(requiresNew: true, isTransactional: true);
                var batch = await _invoices.GetListAsync(x => ids.Contains(x.Id));
                if (batch.Count > 0)
                {
                    var settings = await _accounts.GetForInvoiceAsync(batch[0]);
                    await RefreshAsync(settings, batch, now);
                }

                await uow.CompleteAsync();
            }
            catch (BusinessException ex) when (ex.Code == BlueDentalDomainErrorCodes.EInvoicing.NotConfigured)
            {
                // The account was removed after these went out; ↻ says so to whoever asks.
            }
            catch (Exception ex)
            {
                // The type only: a provider or database message may quote the buyer.
                _logger.LogWarning("EInvoice sync: a batch of {Count} failed ({Error}).", ids.Length, ex.GetType().Name);
            }
        }

        return targets.Count;
    }

    /// <summary>
    /// The call log survives the refusal that may follow it: written in its own
    /// unit of work, so throwing afterwards rolls back the invoice row only.
    /// </summary>
    public async Task LogAsync<T>(Guid clinicBranchId, string operation, EasyInvoiceCallResult<T> outcome, int itemCount)
    {
        using var uow = _unitOfWorkManager.Begin(requiresNew: true);
        await _callLogs.InsertAsync(new IntegrationCallLog(
            _guidGenerator.Create(), clinicBranchId, operation, outcome.RequestPath,
            outcome.StatusCode, outcome.Succeeded, outcome.DurationMs, itemCount, outcome.LogError));
        await uow.CompleteAsync();
    }

    private async Task<List<SweepTarget>> SweepTargetsAsync(bool includeSigned, DateTimeOffset now)
    {
        using var uow = _unitOfWorkManager.Begin(requiresNew: true, isTransactional: false);
        var cutoff = now.AddDays(-CancelWindowDays);
        var cutoffTime = cutoff.UtcDateTime;
        var query = (await _invoices.GetQueryableAsync())
            .Where(x => x.Status == ElectronicInvoiceStatus.Draft
                || (includeSigned
                    && (x.Status == ElectronicInvoiceStatus.Published
                        || x.Status == ElectronicInvoiceStatus.Replaced
                        || x.Status == ElectronicInvoiceStatus.Adjusted)
                    && (x.SignedAt >= cutoff || (x.SignedAt == null && x.CreationTime >= cutoffTime))))
            .OrderBy(x => x.LastSyncedAt)
            .Take(MaxPerSweep)
            .Select(x => new SweepTarget(x.Id, x.ProviderConfigId, x.ClinicBranchId));
        var targets = await _asyncExecuter.ToListAsync(query);
        await uow.CompleteAsync();
        return targets;
    }

    /// <summary>A failed download only waits for the next pass; the invoice itself is fine.</summary>
    private async Task StorePdfAsync(EasyInvoiceSettings settings, ElectronicInvoice invoice)
    {
        var outcome = await _provider.GetPdfAsync(settings, invoice.Ikey);
        await LogAsync(invoice.ClinicBranchId, PdfOperation, outcome, 1);
        if (!outcome.Succeeded || outcome.Data is not { Length: > 0 } pdf)
        {
            return;
        }

        var blobName = PdfBlobNameOf(invoice);
        try
        {
            await _blobs.SaveAsync(blobName, pdf, overrideExisting: true);
            invoice.AttachPdf(blobName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("EInvoice sync: storing the PDF of {InvoiceId} failed ({Error}).",
                invoice.Id, ex.GetType().Name);
        }
    }

    /// <summary>The YC-HD of the receipt it bills, or of every receipt of the slip it bills whole.</summary>
    private async Task<List<InvoiceRequest>> LinkedRequestsAsync(ElectronicInvoice invoice)
    {
        if (invoice.PatientPaymentId is { } paymentId)
        {
            return await _requests.GetListAsync(r => r.PatientPaymentId == paymentId);
        }

        return invoice.TreatmentPlanId is { } planId
            ? await _requests.GetListAsync(r => r.TreatmentPlanId == planId)
            : [];
    }

    private void NotifyAfterCommit(Guid branchId)
    {
        var notifier = _serviceProvider.GetService<IEInvoiceNotifier>();
        if (notifier is null)
        {
            return;
        }

        if (_unitOfWorkManager.Current is { } unitOfWork)
        {
            unitOfWork.OnCompleted(() => NotifyQuietlyAsync(notifier, branchId));
            return;
        }

        _ = NotifyQuietlyAsync(notifier, branchId);
    }

    /// <summary>A nudge that fails only means screens wait for their next poll.</summary>
    private async Task NotifyQuietlyAsync(IEInvoiceNotifier notifier, Guid branchId)
    {
        try
        {
            await notifier.NotifyChangedAsync(branchId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("EInvoice sync: notifying branch screens failed ({Error}).", ex.GetType().Name);
        }
    }

    private sealed record SweepTarget(Guid Id, Guid? ProviderConfigId, Guid ClinicBranchId);
}
