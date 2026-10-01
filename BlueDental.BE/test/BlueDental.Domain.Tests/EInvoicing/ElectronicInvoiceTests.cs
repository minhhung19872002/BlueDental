using System;
using System.Linq;
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

    private static EasyInvoiceSettings Account(Guid? configId = null, string pattern = "1C26TYY") =>
        new(configId, "http://sandbox.test", "user", "secret", "0100000000", pattern, null, -1);

    private static ElectronicInvoice Invoice() => ElectronicInvoice.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, Account(), Draft());

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

    [Theory]
    [InlineData(0, "0", ElectronicInvoiceStatus.Draft)]
    [InlineData(1, "0", ElectronicInvoiceStatus.Draft)]
    [InlineData(1, "17", ElectronicInvoiceStatus.Published)]
    [InlineData(2, "17", ElectronicInvoiceStatus.Published)]
    [InlineData(6, "17", ElectronicInvoiceStatus.Published)]
    [InlineData(3, "17", ElectronicInvoiceStatus.Replaced)]
    [InlineData(4, "17", ElectronicInvoiceStatus.Adjusted)]
    [InlineData(5, "17", ElectronicInvoiceStatus.Cancelled)]
    [InlineData(5, "0", ElectronicInvoiceStatus.Cancelled)]
    public void Provider_Status_Codes_Map_To_BlueDental_States(int providerStatus, string no, ElectronicInvoiceStatus expected)
    {
        var invoice = Invoice();
        invoice.ApplyProviderSummary(Summary(providerStatus, no), At);

        Assert.Equal(expected, invoice.Status);
        Assert.Equal(providerStatus, invoice.ProviderStatus);
    }

    [Fact]
    public void A_Line_Name_Over_The_Provider_Limit_Is_Refused()
    {
        var name = new string('R', ElectronicInvoiceDraft.MaxLineNameLength + 1);
        var draft = Draft() with { Lines = [ElectronicInvoiceDraft.Line("TR01", name, "Lần", 1m, 500_000m, -1)] };

        var error = Assert.Throws<BusinessException>(() => draft.Validated());

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft, error.Code);
        Assert.NotNull((Draft() with { Lines = [ElectronicInvoiceDraft.Line("TR01", new string('R', 300), "Lần", 1m, 500_000m, -1)] }).Validated());
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

    [Fact]
    public void An_Invoice_Needs_A_Receipt_Or_A_Slip()
    {
        var error = Assert.Throws<BusinessException>(() => ElectronicInvoice.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Account(), Draft()));

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired, error.Code);
    }

    [Fact]
    public void A_Slip_Invoice_Has_No_Receipt_And_Remembers_Its_Account()
    {
        var configId = Guid.NewGuid();
        var invoice = ElectronicInvoice.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, Guid.NewGuid(), Account(configId), Draft());

        Assert.Null(invoice.PatientPaymentId);
        Assert.Equal(configId, invoice.ProviderConfigId);
        Assert.Equal(ElectronicInvoiceDraft.TransferPaymentMethod, invoice.PaymentMethod);
    }

    [Fact]
    public void A_Draft_Moves_To_The_Branchs_New_Account()
    {
        var invoice = Invoice();
        var configId = Guid.NewGuid();

        invoice.MoveTo(Account(configId, "2C26TAA"));

        Assert.Equal(configId, invoice.ProviderConfigId);
        Assert.Equal("2C26TAA", invoice.Pattern);
    }

    [Fact]
    public void A_Signed_Invoice_Neither_Moves_Nor_Lets_Its_Receipt_Go()
    {
        var invoice = Invoice();
        invoice.ApplyProviderSummary(Summary(1, "17"), At);

        Assert.Throws<BusinessException>(() => invoice.MoveTo(Account(Guid.NewGuid())));
        var error = Assert.Throws<BusinessException>(invoice.EnsureReceiptRemovable);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.ReceiptInvoiced, error.Code);
        Assert.Equal("17", error.Data["No"]);
    }

    [Fact]
    public void A_Drafts_Receipt_May_Be_Removed()
    {
        Invoice().EnsureReceiptRemovable();
    }

    [Fact]
    public void A_Slip_Billed_One_Way_Blocks_The_Other_Way_Until_That_Invoice_Is_Cancelled()
    {
        var planId = Guid.NewGuid();
        var wholeSlip = ElectronicInvoice.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, planId, Account(), Draft());
        var receipt = ElectronicInvoice.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), planId, Account(), Draft());
        var otherSlip = ElectronicInvoice.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Account(), Draft());

        bool Blocks(ElectronicInvoice existing, bool issuingWholeSlip) =>
            new[] { existing }.AsQueryable().Any(ElectronicInvoice.BillsSlipOtherWay(planId, issuingWholeSlip));

        Assert.True(Blocks(wholeSlip, issuingWholeSlip: false));
        Assert.True(Blocks(receipt, issuingWholeSlip: true));
        Assert.False(Blocks(wholeSlip, issuingWholeSlip: true));
        Assert.False(Blocks(otherSlip, issuingWholeSlip: true));

        wholeSlip.ApplyProviderSummary(Summary(5, "17"), At);
        receipt.ApplyProviderSummary(Summary(5, "18"), At);

        Assert.False(Blocks(wholeSlip, issuingWholeSlip: false));
        Assert.False(Blocks(receipt, issuingWholeSlip: true));
    }
}
