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
        IEnumerable<PaymentLineDraft>? lines = null,
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

    [Fact]
    public void A_Bank_Refund_Names_No_Account_Because_The_Money_Goes_Out()
    {
        var refund = PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Refund,
            method: PaymentMethodKind.Banking,
            amount: 100_000m,
            code: "HT26-0001",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan,
            splitMode: PaymentSplitMode.Manual,
            lines: [(ServiceA, 100_000m)]);

        refund.PaymentAccountId.ShouldBeNull();
        refund.SignedAmount.ShouldBe(-100_000m);
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

    private static PatientPayment Pending(decimal amount, IEnumerable<PaymentLineDraft> lines) =>
        PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Payment,
            method: PaymentMethodKind.Cash,
            amount: amount,
            code: "PT26-0002",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow.AddHours(-2),
            treatmentPlanId: Plan,
            lines: lines,
            status: PatientPaymentStatus.Pending);

    [Fact]
    public void A_Receipt_Written_Before_Statuses_Existed_Counts_As_Completed()
    {
        Record(100_000m, [(ServiceA, 100_000m)]).Status.ShouldBe(PatientPaymentStatus.Completed);
    }

    [Fact]
    public void Only_A_Payment_Can_Wait_For_Its_Money()
    {
        // A refund or held money is settled as it is written (BA 2026-10-08).
        var act = () => PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Refund,
            method: PaymentMethodKind.Cash,
            amount: 100_000m,
            code: "HT26-0002",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan,
            lines: [(ServiceA, 100_000m)],
            status: PatientPaymentStatus.Pending);

        Should.Throw<BusinessException>(act)
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition);
    }

    [Fact]
    public void A_Pending_Receipt_Can_Be_Rewritten_Services_And_All()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);
        var account = Guid.NewGuid();

        payment.Revise(
            PaymentSplitMode.Manual,
            PaymentMethodKind.Banking,
            1_500_000m,
            account,
            "chuyển khoản",
            [(ServiceA, 1_000_000m), (ServiceB, 500_000m)],
            Guid.NewGuid);

        payment.IsPending.ShouldBeTrue();
        payment.Amount.ShouldBe(1_500_000m);
        payment.Method.ShouldBe(PaymentMethodKind.Banking);
        payment.PaymentAccountId.ShouldBe(account);
        payment.SplitMode.ShouldBe(PaymentSplitMode.Manual);
        payment.Note.ShouldBe("chuyển khoản");
        payment.AmountFor(ServiceA).ShouldBe(1_000_000m);
        payment.AmountFor(ServiceB).ShouldBe(500_000m);
    }

    [Fact]
    public void A_Rewrite_Whose_Lines_Miss_The_Total_Is_Refused()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        Should.Throw<BusinessException>(() => payment.Revise(
                PaymentSplitMode.Manual,
                PaymentMethodKind.Cash,
                1_500_000m,
                null,
                null,
                [(ServiceA, 1_000_000m)],
                Guid.NewGuid))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation);
    }

    private static PatientPayment Issued(decimal amount, IEnumerable<PaymentLineDraft> lines) =>
        Export(Pending(amount, lines), DateTimeOffset.UtcNow, Guid.NewGuid());

    private const string FileName = "receipts/branch/payment.pdf.enc";
    private static readonly string Sha256 = new('a', 64);

    private static PatientPayment Export(PatientPayment payment, DateTimeOffset at, Guid? accountant) =>
        payment.Issue(at, accountant, ReceiptSignMode.Unsigned, FileName, Sha256);

    private static void Revise(PatientPayment payment) =>
        payment.Revise(
            PaymentSplitMode.Auto,
            PaymentMethodKind.Cash,
            1_000_000m,
            null,
            null,
            [(ServiceA, 1_000_000m)],
            Guid.NewGuid);

    [Fact]
    public void Exporting_Locks_The_Receipt_But_Moves_No_Money()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);
        var issuedAt = DateTimeOffset.UtcNow;
        var accountant = Guid.NewGuid();

        Export(payment, issuedAt, accountant);

        payment.Status.ShouldBe(PatientPaymentStatus.Issued);
        payment.IsCompleted.ShouldBeFalse();
        payment.IssuedAt.ShouldBe(issuedAt);
        payment.IssuedById.ShouldBe(accountant);
        payment.SignMode.ShouldBe(ReceiptSignMode.Unsigned);
        payment.ReceiptFileName.ShouldBe(FileName);
        payment.ReceiptFileSha256.ShouldBe(Sha256);
        payment.HasReceiptFile.ShouldBeTrue();
        Should.Throw<BusinessException>(() => Revise(payment))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
        Should.Throw<BusinessException>(() => Export(payment, DateTimeOffset.UtcNow, accountant))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
    }

    [Fact]
    public void Digital_Signing_Is_Refused_Until_Phase_7()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        Should.Throw<BusinessException>(() =>
                payment.Issue(DateTimeOffset.UtcNow, null, ReceiptSignMode.Digital, FileName, Sha256))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.ReceiptDigitalSignUnavailable);
        payment.Status.ShouldBe(PatientPaymentStatus.Pending);
        payment.HasReceiptFile.ShouldBeFalse();
    }

    [Fact]
    public void An_Export_Must_Name_Its_File_And_Hash()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        Should.Throw<ArgumentException>(() =>
            payment.Issue(DateTimeOffset.UtcNow, null, ReceiptSignMode.Unsigned, FileName, "abc"));
        Should.Throw<ArgumentException>(() =>
            payment.Issue(DateTimeOffset.UtcNow, null, ReceiptSignMode.Unsigned, " ", Sha256));
        payment.Status.ShouldBe(PatientPaymentStatus.Pending);
    }

    [Fact]
    public void An_Unexported_Receipt_Cannot_Be_Confirmed()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        Should.Throw<BusinessException>(() => payment.Confirm(Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentNotIssued);
        payment.IsPending.ShouldBeTrue();
    }

    [Fact]
    public void Confirming_Keeps_The_Picked_Payment_Day_And_Credits_The_Cashier()
    {
        var payment = Issued(2_000_000m, [(ServiceA, 2_000_000m)]);
        var pickedDay = payment.PaidAt;
        var cashier = Guid.NewGuid();

        payment.Confirm(cashier);

        payment.Status.ShouldBe(PatientPaymentStatus.Completed);
        payment.PaidAt.ShouldBe(pickedDay);
        payment.StaffId.ShouldBe(cashier);
    }

    [Fact]
    public void A_Paid_Receipt_Is_Final_But_Can_Be_Cancelled()
    {
        var payment = Issued(2_000_000m, [(ServiceA, 2_000_000m)]);
        payment.Confirm(Guid.NewGuid());

        Should.Throw<BusinessException>(() => payment.Confirm(Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
        Should.Throw<BusinessException>(() => Revise(payment))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);

        payment.Cancel(PaymentCancelReason.Duplicate, "lập trùng", DateTimeOffset.UtcNow, Guid.NewGuid());

        payment.Status.ShouldBe(PatientPaymentStatus.Cancelled);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void An_Exported_Or_Paid_Receipt_Is_Cancelled_With_A_Fixed_Reason(bool paid)
    {
        var payment = Issued(2_000_000m, [(ServiceA, 2_000_000m)]);
        if (paid) payment.Confirm(Guid.NewGuid());

        Should.Throw<BusinessException>(() => payment.Cancel(null, "nhầm", DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonCodeRequired);
        Should.Throw<BusinessException>(() => payment.Cancel((PaymentCancelReason)9, "nhầm", DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonCodeRequired);
        Should.Throw<BusinessException>(() => payment.Cancel(PaymentCancelReason.Other, " ", DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonRequired);
    }

    [Fact]
    public void Cancelling_Keeps_Why_Who_And_When_Apart_From_The_Export()
    {
        var payment = Issued(2_000_000m, [(ServiceA, 2_000_000m)]);
        var issuedAt = payment.IssuedAt;
        var cancelledAt = DateTimeOffset.UtcNow.AddMinutes(5);
        var canceller = Guid.NewGuid();

        payment.Cancel(PaymentCancelReason.WrongPayer, "  sai tên người nộp  ", cancelledAt, canceller);

        payment.Status.ShouldBe(PatientPaymentStatus.Cancelled);
        payment.CancelReasonCode.ShouldBe(PaymentCancelReason.WrongPayer);
        payment.CancelReason.ShouldBe("sai tên người nộp");
        payment.CancelledAt.ShouldBe(cancelledAt);
        payment.CancelledById.ShouldBe(canceller);
        payment.IssuedAt.ShouldBe(issuedAt);
    }

    [Fact]
    public void A_Cancelled_Receipt_Is_Final()
    {
        var payment = Issued(2_000_000m, [(ServiceA, 2_000_000m)]);
        payment.Cancel(PaymentCancelReason.Other, "khác", DateTimeOffset.UtcNow, null);

        Should.Throw<BusinessException>(() => payment.Cancel(PaymentCancelReason.Other, "lại", DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCancelled);
        Should.Throw<BusinessException>(() => payment.Confirm(Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCancelled);
        Should.Throw<BusinessException>(() => Export(payment, DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCancelled);
        Should.Throw<BusinessException>(() => Revise(payment))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCancelled);
    }

    [Fact]
    public void A_Pending_Receipt_Is_Cancelled_With_Its_Description_Alone()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        payment.Cancel(null, "khách đổi ý", DateTimeOffset.UtcNow, null);

        payment.Status.ShouldBe(PatientPaymentStatus.Cancelled);
        payment.CancelReason.ShouldBe("khách đổi ý");
        payment.CancelReasonCode.ShouldBeNull();
    }

    [Fact]
    public void A_Refund_Is_Final_Once_Written()
    {
        var refund = PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Refund,
            method: PaymentMethodKind.Cash,
            amount: 100_000m,
            code: "HOANTIEN-01/2026",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan);

        Should.Throw<BusinessException>(() => refund.Cancel(PaymentCancelReason.Other, "nhầm", DateTimeOffset.UtcNow, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
    }

    [Theory]
    [InlineData(PatientPaymentStatus.Issued)]
    [InlineData(PatientPaymentStatus.Cancelled)]
    public void A_Receipt_Is_Never_Written_Exported_Or_Cancelled(PatientPaymentStatus status)
    {
        Should.Throw<BusinessException>(() => PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Payment,
            method: PaymentMethodKind.Cash,
            amount: 100_000m,
            code: "THANHTOAN-01/DT01/2026",
            staffId: Guid.NewGuid(),
            paidAt: DateTimeOffset.UtcNow,
            treatmentPlanId: Plan,
            lines: [(ServiceA, 100_000m)],
            status: status));
    }

    private static PaymentReceiptSnapshot Snapshot(decimal amount, decimal slipTotal = 5_000_000m, decimal paidBefore = 1_000_000m) =>
        PaymentReceiptSnapshot.Take(
            "BN0001",
            "Khách Thử",
            "DT03",
            new DateOnly(2026, 10, 27),
            PaymentMethodKind.Cash,
            amount,
            slipTotal,
            paidBefore,
            "Thu Ngân",
            [new PaymentReceiptSnapshotLine("Khám & tư vấn", amount)]);

    [Fact]
    public void The_Receipt_Content_Spells_Its_Amount_And_What_The_Slip_Still_Owes()
    {
        var snapshot = Snapshot(2_300_000m);

        snapshot.AmountInWords.ShouldBe("Hai triệu ba trăm nghìn đồng");
        snapshot.Remaining.ShouldBe(1_700_000m);
        snapshot.RemainingInWords.ShouldBe("Một triệu bảy trăm nghìn đồng");
        snapshot.Lines.Single().Name.ShouldBe("Khám & tư vấn");
    }

    [Fact]
    public void What_The_Slip_Still_Owes_Never_Goes_Below_Zero()
    {
        Snapshot(2_000_000m, slipTotal: 2_500_000m, paidBefore: 1_000_000m).Remaining.ShouldBe(0m);
    }

    [Fact]
    public void An_Unpaid_Receipt_Freezes_Its_Content_And_Refreezes_It_On_A_Revise()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);
        payment.FreezeReceipt(Snapshot(2_000_000m));

        Revise(payment);
        payment.FreezeReceipt(Snapshot(1_000_000m));

        payment.ReceiptSnapshot!.Amount.ShouldBe(1_000_000m);
    }

    [Fact]
    public void Content_Disagreeing_With_The_Receipt_Total_Is_Refused()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);

        Should.Throw<BusinessException>(() => payment.FreezeReceipt(Snapshot(1_999_000m)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation);
    }

    [Fact]
    public void An_Exported_Receipt_Keeps_The_Content_The_Customer_Saw()
    {
        var payment = Pending(2_000_000m, [(ServiceA, 2_000_000m)]);
        payment.FreezeReceipt(Snapshot(2_000_000m));
        Export(payment, DateTimeOffset.UtcNow, Guid.NewGuid());

        Should.Throw<BusinessException>(() => payment.FreezeReceipt(Snapshot(2_000_000m)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
        payment.ReceiptSnapshot!.CreatorName.ShouldBe("Thu Ngân");
    }
}
