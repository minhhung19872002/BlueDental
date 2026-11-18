using System;
using System.Linq;
using Volo.Abp;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>
/// The BA 2026-11-18 flow: Lưu Nháp keeps the dialog here, Lưu sends it unsigned
/// ("Chờ kiểm tra"), the accountant signs on the portal, the sync hears it, and an
/// invoice cancelled there goes out again as the next round of the same row.
/// </summary>
public class ElectronicInvoiceTests
{
    private const string SourceKey = "bd-abc";
    private static readonly DateTimeOffset At = new(2026, 11, 18, 10, 0, 0, TimeSpan.FromHours(7));

    private static ElectronicInvoiceDraft Draft(string ikey = SourceKey, decimal price = 500_000m) => new()
    {
        Ikey = ikey,
        CustomerCode = "BN0001",
        CustomerName = "Nguyễn Văn Test",
        PaymentMethod = ElectronicInvoiceDraft.TransferPaymentMethod,
        VatRate = -1,
        Lines = [ElectronicInvoiceDraft.Line("TR01", "Trám răng", "Lần", 1m, price, -1)]
    };

    private static EasyInvoiceSettings Account(Guid? configId = null, string pattern = "1C26TYY") =>
        new(configId, "http://sandbox.test", "user", "secret", "0100000000", pattern, null, -1);

    private static ElectronicInvoice Opened(Guid? paymentId = null, Guid? planId = null) => ElectronicInvoice.Open(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), paymentId ?? Guid.NewGuid(), planId, SourceKey);

    private static ElectronicInvoice Waiting(Guid? configId = null)
    {
        var invoice = Opened();
        invoice.Sent(Account(configId), Draft(), "{}", At);
        return invoice;
    }

    private static ElectronicInvoice Signed(string no = "17")
    {
        var invoice = Waiting();
        invoice.ApplyProviderSummary(Summary(1, no), At.AddMinutes(5));
        return invoice;
    }

    private static ProviderInvoiceSummary Summary(int status, string no, string ikey = SourceKey) =>
        new(ikey, status, "1C26TYY", "", no, "LOOKUP1", "http://view", 500_000m, 0m, 500_000m, "Nguyễn Văn Test");

    [Fact]
    public void An_Opened_Invoice_Is_Only_Kept_Here()
    {
        var invoice = Opened();

        Assert.Equal(ElectronicInvoiceStatus.NotSent, invoice.Status);
        Assert.Equal(0, invoice.Round);
        Assert.Equal(SourceKey, invoice.Ikey);
        Assert.Empty(invoice.Attempts);
        Assert.False(invoice.IsSigned);
    }

    [Fact]
    public void An_Invoice_Needs_A_Receipt_Or_A_Slip()
    {
        var error = Assert.Throws<BusinessException>(() => ElectronicInvoice.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, SourceKey));

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired, error.Code);
    }

    [Fact]
    public void Luu_Nhap_Keeps_The_Form_And_Amounts_Without_Sending()
    {
        var invoice = Opened();

        invoice.SaveForm("{\"buyerName\":\"A\"}", Draft());
        invoice.SaveForm("{\"buyerName\":\"B\"}", Draft(price: 300_000m));

        Assert.Equal(ElectronicInvoiceStatus.NotSent, invoice.Status);
        Assert.Equal("{\"buyerName\":\"B\"}", invoice.FormJson);
        Assert.Equal(300_000m, invoice.Amount);
        Assert.Empty(invoice.Attempts);
        Assert.Equal(0, invoice.Round);
    }

    [Fact]
    public void Luu_Sends_Round_One_And_Waits_For_Review()
    {
        var configId = Guid.NewGuid();
        var invoice = Opened();
        Assert.Equal(SourceKey, invoice.IkeyForSend());

        invoice.Sent(Account(configId), Draft(), "{}", At);

        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);
        Assert.Equal(1, invoice.Round);
        Assert.Equal(configId, invoice.ProviderConfigId);
        Assert.Equal("1C26TYY", invoice.Pattern);
        var attempt = Assert.Single(invoice.Attempts);
        Assert.Equal(1, attempt.Round);
        Assert.Equal(SourceKey, attempt.Ikey);
        Assert.Equal(At, attempt.SentAt);
        Assert.Null(attempt.SignedAt);
    }

    [Fact]
    public void Luu_Again_While_Waiting_Rewrites_The_Same_Round()
    {
        var invoice = Waiting();
        Assert.Equal(SourceKey, invoice.IkeyForSend());

        invoice.Sent(Account(), Draft(price: 400_000m), "{\"v\":2}", At.AddMinutes(3));

        var attempt = Assert.Single(invoice.Attempts);
        Assert.Equal(1, invoice.Round);
        Assert.Equal(400_000m, attempt.Amount);
        Assert.Equal(At.AddMinutes(3), attempt.SentAt);
        Assert.Equal("{\"v\":2}", invoice.FormJson);
    }

    [Fact]
    public void A_Waiting_Invoice_Cannot_Go_Back_To_Luu_Nhap()
    {
        var error = Assert.Throws<BusinessException>(() => Waiting().SaveForm("{}", Draft()));

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.AlreadySent, error.Code);
    }

    [Fact]
    public void A_Draft_Built_For_Another_Round_Is_Refused()
    {
        var error = Assert.Throws<BusinessException>(() =>
            Opened().Sent(Account(), Draft(ikey: "bd-abc-2"), "{}", At));

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft, error.Code);
    }

    [Fact]
    public void A_Summary_Without_A_Number_Keeps_It_Waiting()
    {
        var invoice = Waiting();

        var change = invoice.ApplyProviderSummary(Summary(0, "0"), At);

        Assert.Equal(ElectronicInvoiceChange.None, change);
        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);
        Assert.Null(invoice.No);
        Assert.Equal("LOOKUP1", invoice.LookupCode);
        Assert.Null(invoice.SignedAt);
    }

    [Fact]
    public void Signed_On_The_Portal_Is_Heard_Once_And_Blocks_Any_Resend()
    {
        var invoice = Waiting();

        var first = invoice.ApplyProviderSummary(Summary(1, "17"), At.AddMinutes(5));
        var again = invoice.ApplyProviderSummary(Summary(1, "17"), At.AddMinutes(6));

        Assert.Equal(ElectronicInvoiceChange.Signed, first);
        Assert.Equal(ElectronicInvoiceChange.None, again);
        Assert.True(invoice.IsSigned);
        Assert.Equal("17", invoice.No);
        Assert.Equal(At.AddMinutes(5), invoice.SignedAt);
        Assert.Equal(At.AddMinutes(5), invoice.CurrentAttempt!.SignedAt);
        Assert.Equal("17", invoice.CurrentAttempt.No);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished,
            Assert.Throws<BusinessException>(() => invoice.IkeyForSend()).Code);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished,
            Assert.Throws<BusinessException>(() => invoice.SaveForm("{}", Draft())).Code);
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
        var invoice = Waiting();
        invoice.ApplyProviderSummary(Summary(providerStatus, no), At);

        Assert.Equal(expected, invoice.Status);
        Assert.Equal(providerStatus, invoice.ProviderStatus);
    }

    [Fact]
    public void A_Summary_For_Another_Key_Or_For_An_Unsent_Invoice_Is_Refused()
    {
        Assert.Throws<BusinessException>(() => Waiting().ApplyProviderSummary(Summary(0, "0", ikey: "bd-other"), At));
        Assert.Throws<BusinessException>(() => Opened().ApplyProviderSummary(Summary(0, "0"), At));
    }

    [Fact]
    public void Cancelled_On_The_Portal_Goes_Out_Again_As_The_Next_Round()
    {
        var invoice = Signed();

        var change = invoice.ApplyProviderSummary(Summary(5, "17"), At.AddHours(1));
        Assert.Equal(ElectronicInvoiceChange.Cancelled, change);
        Assert.Equal(At.AddHours(1), invoice.CurrentAttempt!.CancelledAt);
        Assert.Equal("bd-abc-2", invoice.IkeyForSend());

        invoice.Sent(Account(), Draft(ikey: "bd-abc-2"), "{}", At.AddHours(2));

        Assert.Equal(2, invoice.Round);
        Assert.Equal("bd-abc-2", invoice.Ikey);
        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);
        Assert.Null(invoice.No);
        Assert.Null(invoice.SignedAt);
        Assert.Collection(invoice.Attempts.OrderBy(a => a.Round),
            first =>
            {
                Assert.Equal(ElectronicInvoiceStatus.Cancelled, first.Status);
                Assert.Equal("17", first.No);
                Assert.NotNull(first.SignedAt);
            },
            second =>
            {
                Assert.Equal("bd-abc-2", second.Ikey);
                Assert.Equal(ElectronicInvoiceStatus.Draft, second.Status);
            });
    }

    [Fact]
    public void Luu_Nhap_After_A_Cancel_Prepares_The_Next_Round()
    {
        var invoice = Signed();
        invoice.ApplyProviderSummary(Summary(5, "17"), At.AddHours(1));

        invoice.SaveForm("{\"retry\":true}", Draft());

        Assert.Equal(ElectronicInvoiceStatus.NotSent, invoice.Status);
        Assert.Equal("bd-abc-2", invoice.Ikey);
        Assert.Equal(1, invoice.Round);
        Assert.Null(invoice.No);
        Assert.Equal("bd-abc-2", invoice.IkeyForSend());
    }

    [Fact]
    public void Only_A_Signed_Invoice_Keeps_A_Pdf()
    {
        Assert.Throws<BusinessException>(() => Waiting().AttachPdf("einvoices/x.pdf"));

        var invoice = Signed();
        invoice.AttachPdf("einvoices/x.pdf");

        Assert.Equal("einvoices/x.pdf", invoice.PdfBlobName);
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
    public void A_Failure_Is_Kept_Until_The_Next_Successful_Sync_Clears_It()
    {
        var invoice = Waiting();
        invoice.RecordFailure("175: bad signature", At);
        Assert.Equal("175: bad signature", invoice.LastError);
        Assert.Equal(ElectronicInvoiceStatus.Draft, invoice.Status);

        invoice.ApplyProviderSummary(Summary(0, "0"), At.AddMinutes(1));
        Assert.Null(invoice.LastError);
    }

    [Fact]
    public void A_Receipt_Whose_Invoice_Was_Never_Signed_May_Be_Removed()
    {
        Opened().EnsureReceiptRemovable();
        Waiting().EnsureReceiptRemovable();
    }

    [Fact]
    public void A_Receipt_Whose_Invoice_Was_Ever_Signed_Stays_Even_After_A_Cancel()
    {
        var signed = Signed();
        var error = Assert.Throws<BusinessException>(signed.EnsureReceiptRemovable);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.ReceiptInvoiced, error.Code);
        Assert.Equal("17", error.Data["No"]);

        signed.ApplyProviderSummary(Summary(5, "17"), At.AddHours(1));
        signed.SaveForm("{}", Draft());
        Assert.Throws<BusinessException>(signed.EnsureReceiptRemovable);
    }

    [Fact]
    public void A_Slip_Billed_One_Way_Blocks_The_Other_Way_Only_While_It_Is_At_The_Provider()
    {
        var planId = Guid.NewGuid();
        var wholeSlip = ElectronicInvoice.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, planId, SourceKey);
        var receipt = ElectronicInvoice.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), planId, SourceKey);
        var otherSlip = ElectronicInvoice.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), SourceKey);

        bool Blocks(ElectronicInvoice existing, bool issuingWholeSlip) =>
            new[] { existing }.AsQueryable().Any(ElectronicInvoice.BillsSlipOtherWay(planId, issuingWholeSlip));

        // Only saved here: bills nothing yet.
        Assert.False(Blocks(wholeSlip, issuingWholeSlip: false));
        Assert.False(Blocks(receipt, issuingWholeSlip: true));

        foreach (var invoice in new[] { wholeSlip, receipt, otherSlip })
        {
            invoice.Sent(Account(), Draft(), "{}", At);
        }

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
