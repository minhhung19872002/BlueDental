using System;
using BlueDental.Billing;
using BlueDental.Billing.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>Voided: a reason is required, and a paid or closed invoice stays as it is.</summary>
public class InvoiceVoidTests
{
    private static Invoice Draft() =>
        new(
            Guid.NewGuid(),
            "HD-202610-0001",
            Guid.NewGuid(),
            Guid.NewGuid(),
            new Money(1_000_000m, "VND"),
            Money.Zero("VND"),
            Money.Zero("VND"),
            DateTimeOffset.UtcNow.AddDays(7));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Void_Without_A_Reason_Is_Refused(string reason)
    {
        var invoice = Draft();

        Should.Throw<BusinessException>(() => invoice.Void(reason))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.VoidReasonRequired);
        invoice.Status.ShouldBe(InvoiceStatus.Draft);
    }

    [Fact]
    public void Void_Keeps_The_Trimmed_Reason()
    {
        var invoice = Draft().Issue();

        invoice.Void("  Khách đổi ý  ");

        invoice.Status.ShouldBe(InvoiceStatus.Voided);
        invoice.Notes.ShouldBe("Khách đổi ý");
    }

    [Fact]
    public void A_Paid_Invoice_Cannot_Be_Voided()
    {
        var invoice = Draft().Issue();
        invoice.RecordPayment(new Money(1_000_000m, "VND"), PaymentMethod.Cash);

        Should.Throw<BusinessException>(() => invoice.Void("Nhầm"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvoiceAlreadyPaid);
    }

    [Fact]
    public void A_Voided_Invoice_Cannot_Be_Voided_Again()
    {
        var invoice = Draft().Void("Nhầm");

        Should.Throw<BusinessException>(() => invoice.Void("Lần nữa"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition);
    }
}
