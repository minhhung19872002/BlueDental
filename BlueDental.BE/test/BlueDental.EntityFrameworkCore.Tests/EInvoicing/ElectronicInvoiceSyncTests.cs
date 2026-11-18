using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.EInvoicing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Shouldly;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Modularity;
using Volo.Abp.Uow;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.EInvoicing;

/// <summary>
/// BA 2026-11-18: the accountant signs on EasyInvoice's portal, which BlueDental
/// cannot do on the sandbox, so the provider is a stub here (owner: "t k test
/// được") — the rows still go through the real EF mapping, attempts jsonb included.
/// </summary>
public class ElectronicInvoiceSyncTests : BlueDentalPostgresTestBase
{
    private static readonly DateTimeOffset At = new DateTimeOffset(2026, 11, 18, 10, 0, 0, TimeSpan.FromHours(7)).ToUniversalTime();

    private readonly StubProvider _provider = new();
    private readonly MemoryBlobs _blobs = new();

    // The container is shared by the whole run, and the sweep reads every row.
    public ElectronicInvoiceSyncTests() => PostgresTestDatabase.Execute(
        "DELETE FROM bd_invoice_request_links; DELETE FROM bd_invoice_requests; DELETE FROM bd_electronic_invoices;");

    // Repositories take their services by property injection, which only Autofac does.
    protected override void SetAbpApplicationCreationOptions(AbpApplicationCreationOptions options) =>
        options.UseAutofac();

    protected override void AfterAddApplication(IServiceCollection services)
    {
        services.Replace(ServiceDescriptor.Singleton<IEasyInvoiceClient>(_provider));
        services.Replace(ServiceDescriptor.Singleton<IBlobContainer>(_blobs));
        services.Configure<EasyInvoiceOptions>(o =>
        {
            o.BaseUrl = "http://stub.test";
            o.Username = "user";
            o.Password = "stub";
            o.TaxCode = "0100000000";
            o.Pattern = "1C26TYY";
        });
    }

    [Fact]
    public async Task Signed_On_The_Portal_Stores_The_Pdf_And_Closes_The_Request()
    {
        var paymentId = Guid.NewGuid();
        var invoiceId = await SeedWaitingAsync(paymentId);
        var requestId = await SeedRequestAsync(paymentId);
        _provider.Answer(Summary(1, "17"));

        (await Sync().SweepAsync(includeSigned: false, At)).ShouldBe(1);

        var invoice = await LoadAsync(invoiceId);
        invoice.Status.ShouldBe(ElectronicInvoiceStatus.Published);
        invoice.No.ShouldBe("17");
        invoice.SignedAt.ShouldNotBeNull();
        invoice.PdfBlobName.ShouldBe(ElectronicInvoiceSync.PdfBlobNameOf(invoice));
        _blobs.Saved[invoice.PdfBlobName!].ShouldBe(StubProvider.Pdf);

        var request = await LoadRequestAsync(requestId);
        request.Status.ShouldBe(InvoiceRequestStatus.Issued);
        request.InvoiceNo.ShouldBe("17");
    }

    [Fact]
    public async Task A_Draft_Still_Waiting_Stays_Waiting_And_Is_Asked_Again()
    {
        var invoiceId = await SeedWaitingAsync(Guid.NewGuid());
        _provider.Answer(Summary(0, "0"));

        await Sync().SweepAsync(includeSigned: false, At);

        var invoice = await LoadAsync(invoiceId);
        invoice.Status.ShouldBe(ElectronicInvoiceStatus.Draft);
        invoice.LastSyncedAt.ShouldNotBeNull();
        _provider.PdfCalls.ShouldBe(0);
        (await Sync().SweepAsync(includeSigned: false, At.AddMinutes(1))).ShouldBe(1);
    }

    [Fact]
    public async Task Cancelled_On_The_Portal_Marks_The_Request_Da_Huy_And_Lets_The_Next_Round_Go()
    {
        var paymentId = Guid.NewGuid();
        var invoiceId = await SeedWaitingAsync(paymentId);
        var requestId = await SeedRequestAsync(paymentId);
        _provider.Answer(Summary(1, "17"));
        await Sync().SweepAsync(includeSigned: false, At);

        // Signed ones are only looked at by the hourly pass.
        _provider.Answer(Summary(5, "17"));
        (await Sync().SweepAsync(includeSigned: false, At.AddMinutes(1))).ShouldBe(0);
        (await Sync().SweepAsync(includeSigned: true, At.AddHours(1))).ShouldBe(1);

        var invoice = await LoadAsync(invoiceId);
        invoice.Status.ShouldBe(ElectronicInvoiceStatus.Cancelled);
        invoice.IkeyForSend().ShouldBe(ElectronicInvoice.RoundKey(invoice.SourceKey, 2));
        var attempt = invoice.Attempts.ShouldHaveSingleItem();
        attempt.CancelledAt.ShouldNotBeNull();
        attempt.No.ShouldBe("17");

        var request = await LoadRequestAsync(requestId);
        request.Status.ShouldBe(InvoiceRequestStatus.Cancelled);
        request.InvoiceNo.ShouldBeNull();
        request.Reason!.ShouldContain("17");
    }

    [Fact]
    public async Task A_Provider_Failure_Is_Kept_On_The_Row_Without_Changing_It()
    {
        var invoiceId = await SeedWaitingAsync(Guid.NewGuid());
        _provider.Fail = true;

        await Sync().SweepAsync(includeSigned: false, At);

        var invoice = await LoadAsync(invoiceId);
        invoice.Status.ShouldBe(ElectronicInvoiceStatus.Draft);
        invoice.LastError.ShouldNotBeNull();
    }

    private ElectronicInvoiceSync Sync() => GetRequiredService<ElectronicInvoiceSync>();

    private static ProviderInvoiceSummary Summary(int status, string no) =>
        new(StubProvider.Ikey, status, "1C26TYY", "", no, "LOOKUP1", "http://view", 500_000m, 0m, 500_000m, "Test");

    private Task<Guid> SeedWaitingAsync(Guid paymentId) => WithUnitOfWorkAsync(async () =>
    {
        var invoice = ElectronicInvoice.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), paymentId, null, StubProvider.Ikey);
        invoice.Sent(
            new EasyInvoiceSettings(null, "http://stub.test", "user", "stub", "0100000000", "1C26TYY", null, -1),
            new ElectronicInvoiceDraft
            {
                Ikey = StubProvider.Ikey,
                CustomerCode = "BN0001",
                CustomerName = "Test",
                PaymentMethod = ElectronicInvoiceDraft.TransferPaymentMethod,
                VatRate = -1,
                Lines = [ElectronicInvoiceDraft.Line("TR01", "Trám răng", "Lần", 1m, 500_000m, -1)]
            },
            "{}",
            At.AddMinutes(-10));
        await GetRequiredService<IRepository<ElectronicInvoice, Guid>>().InsertAsync(invoice);
        return invoice.Id;
    });

    private Task<Guid> SeedRequestAsync(Guid paymentId) => WithUnitOfWorkAsync(async () =>
    {
        var request = InvoiceRequest.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), paymentId, null, "YC0001",
            InvoiceRequestSource.Staff,
            new InvoiceRequestDetails(false, "Test", 1990, "0900000000", "001090000000", "Hà Nội", null, null, null, null, null),
            "Trám răng", 500_000m, At.AddHours(-1));
        request.Process(Guid.NewGuid(), At.AddMinutes(-10));
        await GetRequiredService<IRepository<InvoiceRequest, Guid>>().InsertAsync(request);
        return request.Id;
    });

    private Task<ElectronicInvoice> LoadAsync(Guid id) =>
        WithUnitOfWorkAsync(() => GetRequiredService<IRepository<ElectronicInvoice, Guid>>().GetAsync(id));

    private Task<InvoiceRequest> LoadRequestAsync(Guid id) =>
        WithUnitOfWorkAsync(() => GetRequiredService<IRepository<InvoiceRequest, Guid>>().GetAsync(id));

    private async Task<T> WithUnitOfWorkAsync<T>(Func<Task<T>> action)
    {
        using var uow = GetRequiredService<IUnitOfWorkManager>().Begin(requiresNew: true);
        var result = await action();
        await uow.CompleteAsync();
        return result;
    }

    private sealed class StubProvider : IEasyInvoiceClient
    {
        public const string Ikey = "bd-sync-test";
        public static readonly byte[] Pdf = [0x25, 0x50, 0x44, 0x46];

        private ProviderInvoiceSummary? _answer;

        public bool Fail { get; set; }
        public int PdfCalls { get; private set; }

        public void Answer(ProviderInvoiceSummary summary) => _answer = summary;

        public Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportInvoiceAsync(
            EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException("The sync never sends.");

        public Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> GetByIkeysAsync(
            EasyInvoiceSettings settings, IReadOnlyList<string> ikeys, CancellationToken cancellationToken = default) =>
            Task.FromResult(Fail
                ? new EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>("/stub", 500, false, 1, "down", 500, null)
                : new EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>(
                    "/stub", 200, true, 1, null, null, _answer == null ? [] : [_answer]));

        public Task<EasyInvoiceCallResult<byte[]>> GetPdfAsync(
            EasyInvoiceSettings settings, string ikey, CancellationToken cancellationToken = default)
        {
            PdfCalls++;
            return Task.FromResult(new EasyInvoiceCallResult<byte[]>("/stub", 200, true, 1, null, null, Pdf));
        }
    }

    private sealed class MemoryBlobs : IBlobContainer
    {
        public ConcurrentDictionary<string, byte[]> Saved { get; } = new();

        public async Task SaveAsync(string name, Stream stream, bool overrideExisting = false, CancellationToken cancellationToken = default)
        {
            using var copy = new MemoryStream();
            await stream.CopyToAsync(copy, cancellationToken);
            Saved[name] = copy.ToArray();
        }

        public Task<bool> DeleteAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult(Saved.TryRemove(name, out _));

        public Task<bool> ExistsAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult(Saved.ContainsKey(name));

        public Task<Stream> GetAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult<Stream>(new MemoryStream(Saved[name]));

        public Task<Stream?> GetOrNullAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult<Stream?>(Saved.TryGetValue(name, out var bytes) ? new MemoryStream(bytes) : null);
    }
}
