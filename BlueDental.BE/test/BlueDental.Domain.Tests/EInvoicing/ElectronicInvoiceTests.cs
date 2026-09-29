using System;
using Volo.Abp;
using Xunit;

namespace BlueDental.EInvoicing;

public class ElectronicInvoiceTests
{
    private static readonly DateTimeOffset At = new(2026, 9, 28, 10, 0, 0, TimeSpan.FromHours(7));

    private static ElectronicInvoiceDraft Draft() => new()
    {
        Ikey = "bd-abc",
        CustomerCode = "BN0001",
        CustomerName = "Nguyễn Văn Test",
        PaymentMethod = ElectronicInvoiceDraft.TransferPaymentMethod,
        VatRate = -1,
        Lines = [ElectronicInvoiceDraft.Line("TR01", "Trám răng", "Lần", 1m, 500_000m, -1)]
    };

    private static ElectronicInvoice Invoice() => ElectronicInvoice.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, "bd-abc", "1C26TYY", Draft());

    private static ProviderInvoiceSummary Summary(int status, string no, string ikey = "bd-abc") =>
        new(ikey, status, "1C26TYY", "", no, "LOOKUP1", "http://view", 500_000m, 0m, 500_000m, "Nguyễn Văn Test");

    [Fact]
    public void A_New_Invoice_Is_A_Draft_Carrying_The_Draft_Amounts()
    {
        var invoice = Invoice();

        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);
        Assert.Equal(ElectronicInvoice.EasyInvoiceProvider, invoice.Provider);
        Assert.Equal(500_000m, invoice.Total);
        Assert.Equal(0m, invoice.TaxAmount);
        Assert.Equal(500_000m, invoice.Amount);
        Assert.Equal("Nguyễn Văn Test", invoice.CustomerName);
        Assert.Null(invoice.No);
    }

    [Fact]
    public void Provider_Summary_Without_A_Number_Keeps_It_A_Draft()
    {
        var invoice = Invoice();
        invoice.ApplyProviderSummary(Summary(0, "0"), At);

        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);
        Assert.Null(invoice.No);
        Assert.Equal("LOOKUP1", invoice.LookupCode);
        Assert.Equal(At, invoice.LastSyncedAt);
        Assert.Null(invoice.LastError);
    }

    [Fact]
    public void A_Numbered_Summary_Publishes_The_Invoice_And_Blocks_Reissue()
    {
        var invoice = Invoice();
        invoice.ApplyProviderSummary(Summary(1, "17"), At);

        Assert.Equal(ElectronicInvoiceStatus.Published, invoice.Status);
        Assert.Equal("17", invoice.No);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished,
            Assert.Throws<BusinessException>(invoice.EnsureReissuable).Code);
    }

    [Fact]
    public void A_Summary_For_Another_Key_Is_Refused()
    {
        var invoice = Invoice();

        Assert.Throws<BusinessException>(() => invoice.ApplyProviderSummary(Summary(0, "0", ikey: "bd-other"), At));
    }

    [Fact]
    public void A_Failure_Is_Kept_Until_The_Next_Successful_Sync_Clears_It()
    {
        var invoice = Invoice();
        invoice.RecordFailure("175: bad signature", At);
        Assert.Equal("175: bad signature", invoice.LastError);
        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);

        invoice.ApplyProviderSummary(Summary(0, "0"), At.AddMinutes(1));
        Assert.Null(invoice.LastError);
    }

    [Fact]
    public void A_Draft_May_Be_Reissued()
    {
        Invoice().EnsureReissuable();
    }
}
