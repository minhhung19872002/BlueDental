using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>
/// A receipt covers several services, the way the reference's "Tạo phiếu thanh
/// toán" collects them: one payment naming every service, with each service's
/// share on a line of its own.
/// </summary>
public class PatientPaymentTests
{
    private static readonly Guid Plan = Guid.NewGuid();
    private static readonly Guid ServiceA = Guid.NewGuid();
    private static readonly Guid ServiceB = Guid.NewGuid();

    private static PatientPayment Record(
        decimal amount,
        IEnumerable<(Guid, decimal)>? lines = null,
        PaymentMethodKind method = PaymentMethodKind.Cash,
        Guid? accountId = null,
        PaymentSplitMode split = PaymentSplitMode.Auto) =>
        PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Payment,
            method: method,
            amount: amount,
            code: "PT26-0001",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan,
            note: null,
            paymentAccountId: accountId,
            splitMode: split,
            lines: lines);

    [Fact]
    public void One_Receipt_Carries_A_Line_Per_Service()
    {
        var payment = Record(3_000_000m, [(ServiceA, 2_400_000m), (ServiceB, 600_000m)]);

        payment.Lines.Count.ShouldBe(2);
        payment.AmountFor(ServiceA).ShouldBe(2_400_000m);
        payment.AmountFor(ServiceB).ShouldBe(600_000m);
    }

    [Fact]
    public void A_Service_Not_On_The_Receipt_Got_Nothing()
    {
        var payment = Record(2_400_000m, [(ServiceA, 2_400_000m)]);

        payment.AmountFor(ServiceB).ShouldBe(0m);
    }

    [Fact]
    public void Lines_That_Do_Not_Add_Up_To_The_Total_Are_Refused()
    {
        // Letting these disagree would make every per-line "Còn nợ" a lie.
        var act = () => Record(3_000_000m, [(ServiceA, 2_400_000m), (ServiceB, 100_000m)]);

        Should.Throw<BusinessException>(act)
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation);
    }

    [Fact]
    public void A_Line_Of_Zero_Is_Refused()
    {
        var act = () => Record(2_400_000m, [(ServiceA, 2_400_000m), (ServiceB, 0m)]);

        Should.Throw<BusinessException>(act)
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation);
    }

    [Fact]
    public void Money_Held_For_The_Patient_Has_No_Lines()
    {
        var prepaid = PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Prepaid,
            method: PaymentMethodKind.Cash,
            amount: 500_000m,
            code: "TT26-0001",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow);

        prepaid.Lines.ShouldBeEmpty();
        prepaid.TreatmentPlanId.ShouldBeNull();
    }

    [Theory]
    [InlineData(PaymentMethodKind.Banking)]
    [InlineData(PaymentMethodKind.EWallet)]
    public void Bank_And_Wallet_Must_Name_The_Account_They_Landed_In(PaymentMethodKind method)
    {
        var act = () => Record(100_000m, [(ServiceA, 100_000m)], method);

        Should.Throw<BusinessException>(act)
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired);
    }

    [Theory]
    [InlineData(PaymentMethodKind.Cash)]
    [InlineData(PaymentMethodKind.Card)]
    [InlineData(PaymentMethodKind.OutstandingDebt)]
    public void The_Other_Methods_Collect_Into_No_Account(PaymentMethodKind method)
    {
        // An account handed in anyway is dropped rather than stored misleadingly.
        var payment = Record(100_000m, [(ServiceA, 100_000m)], method, accountId: Guid.NewGuid());

        payment.PaymentAccountId.ShouldBeNull();
    }

    [Fact]
    public void The_Split_Mode_Is_Kept_So_A_Receipt_Reopens_As_It_Was_Written()
    {
        var manual = Record(
            100_000m,
            [(ServiceA, 100_000m)],
            split: PaymentSplitMode.Manual);

        manual.SplitMode.ShouldBe(PaymentSplitMode.Manual);
    }

    [Fact]
    public void A_Refund_Signs_Its_Total_Negative()
    {
        var refund = PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Refund,
            method: PaymentMethodKind.Cash,
            amount: 250_000m,
            code: "HT26-0001",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan,
            lines: [(ServiceA, 250_000m)]);

        refund.SignedAmount.ShouldBe(-250_000m);
        refund.Lines.Single().Amount.ShouldBe(250_000m);
    }
}
