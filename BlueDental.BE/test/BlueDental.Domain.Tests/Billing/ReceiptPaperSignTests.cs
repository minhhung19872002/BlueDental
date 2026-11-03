using System;
using BlueDental.Billing;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>
/// P2910_02: "In phiếu thu" for a hand signature, the accountant's Ký điện tử,
/// and the receipt log the BA asked for on "Xuất phiếu thu".
/// </summary>
public class ReceiptPaperSignTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid Service = Guid.NewGuid();
    private const string FileName = "receipts/branch/payment.pdf.enc";
    private static readonly string Sha256 = new('b', 64);

    private static PatientPayment Pending() =>
        PatientPayment.Record(
            Guid.NewGuid(),
            patientId: Guid.NewGuid(),
            clinicBranchId: Guid.NewGuid(),
            kind: PatientPaymentKind.Payment,
            method: PaymentMethodKind.Cash,
            amount: 1_000_000m,
            code: "THANHTOAN-0001",
            staffId: Guid.NewGuid(),
            paidAt: T0,
            treatmentPlanId: Guid.NewGuid(),
            lines: [(Service, 1_000_000m)],
            status: PatientPaymentStatus.Pending);

    [Fact]
    public void Printing_Keeps_The_First_Time_And_Cashier()
    {
        var payment = Pending();
        var cashier = Guid.NewGuid();

        payment.SignOnPaper(T0, cashier);
        payment.SignOnPaper(T0.AddMinutes(3), Guid.NewGuid());

        payment.IsSignedOnPaper.ShouldBeTrue();
        payment.PaperSignedAt.ShouldBe(T0);
        payment.PaperSignedById.ShouldBe(cashier);
        payment.Status.ShouldBe(PatientPaymentStatus.Pending);
    }

    [Fact]
    public void An_Exported_Receipt_Cannot_Go_To_Paper()
    {
        var payment = Pending();
        payment.Issue(T0, Guid.NewGuid(), ReceiptSignMode.Unsigned, FileName, Sha256);

        Should.Throw<BusinessException>(() => payment.SignOnPaper(T0, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted);
        payment.IsSignedOnPaper.ShouldBeFalse();
    }

    [Fact]
    public void An_Edit_Takes_The_Receipt_Back_From_Paper()
    {
        var payment = Pending();
        payment.SignOnPaper(T0, Guid.NewGuid());

        payment.Revise(
            PaymentSplitMode.Auto, PaymentMethodKind.Cash, 800_000m, null, null, [(Service, 800_000m)], Guid.NewGuid);

        payment.IsSignedOnPaper.ShouldBeFalse();
        payment.PaperSignedById.ShouldBeNull();
    }

    [Fact]
    public void Electronic_Export_Needs_A_Saved_Signature()
    {
        var payment = Pending();

        Should.Throw<BusinessException>(() =>
                payment.Issue(T0, Guid.NewGuid(), ReceiptSignMode.Electronic, FileName, Sha256))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.AccountantSignatureMissing);
        payment.Status.ShouldBe(PatientPaymentStatus.Pending);
    }

    [Fact]
    public void Electronic_Export_Records_Whose_Signature_And_When_It_Was_Saved()
    {
        var payment = Pending();
        var accountant = Guid.NewGuid();
        var signer = new ReceiptSigner(accountant, T0.AddDays(-2));

        payment.Issue(T0, accountant, ReceiptSignMode.Electronic, FileName, Sha256, signer);

        payment.Status.ShouldBe(PatientPaymentStatus.Issued);
        payment.SignMode.ShouldBe(ReceiptSignMode.Electronic);
        payment.AccountantSignerId.ShouldBe(accountant);
        payment.AccountantSignatureSavedAt.ShouldBe(T0.AddDays(-2));
    }

    [Fact]
    public void A_Hand_Signed_Export_Keeps_No_Signer()
    {
        var payment = Pending();

        payment.Issue(T0, Guid.NewGuid(), ReceiptSignMode.Unsigned, FileName, Sha256, new ReceiptSigner(Guid.NewGuid(), T0));

        payment.AccountantSignerId.ShouldBeNull();
        payment.AccountantSignatureSavedAt.ShouldBeNull();
    }

    [Fact]
    public void Log_Reads_The_Print_From_The_Receipt()
    {
        var payment = Pending();
        var cashier = Guid.NewGuid();
        payment.SignOnPaper(T0, cashier);

        var log = PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), payment);

        log.Action.ShouldBe(ReceiptLogAction.PrintedForPaper);
        log.PatientPaymentId.ShouldBe(payment.Id);
        log.ClinicBranchId.ShouldBe(payment.ClinicBranchId);
        log.At.ShouldBe(T0);
        log.UserId.ShouldBe(cashier);
        Should.Throw<ArgumentException>(() => PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), Pending()));
    }

    [Fact]
    public void Log_Of_An_Export_Carries_Time_User_Signer_And_File_Hash()
    {
        var payment = Pending();
        payment.SignOnPaper(T0, Guid.NewGuid());
        var accountant = Guid.NewGuid();
        payment.Issue(T0.AddMinutes(5), accountant, ReceiptSignMode.Electronic, FileName, Sha256,
            new ReceiptSigner(accountant, T0.AddDays(-1)));

        var log = PaymentReceiptLog.Exported(Guid.NewGuid(), payment, customerSignedAt: T0);

        log.Action.ShouldBe(ReceiptLogAction.Exported);
        log.At.ShouldBe(T0.AddMinutes(5));
        log.UserId.ShouldBe(accountant);
        log.SignMode.ShouldBe(ReceiptSignMode.Electronic);
        log.AccountantSignerId.ShouldBe(accountant);
        log.AccountantSignatureSavedAt.ShouldBe(T0.AddDays(-1));
        log.CustomerSignedAt.ShouldBe(T0);
        log.CustomerSignedOnPaper.ShouldBe(true);
        log.FileSha256.ShouldBe(Sha256);
    }

    [Fact]
    public void Log_Of_An_Export_Before_The_Export_Is_Refused()
    {
        Should.Throw<BusinessException>(() => PaymentReceiptLog.Exported(Guid.NewGuid(), Pending(), T0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.PaymentNotIssued);
    }

    [Fact]
    public void Log_Of_A_Cancel_Carries_Time_User_And_Reason()
    {
        var payment = Pending();
        payment.Issue(T0, Guid.NewGuid(), ReceiptSignMode.Unsigned, FileName, Sha256);
        var canceller = Guid.NewGuid();
        payment.Cancel(PaymentCancelReason.WrongPayer, "sai tên", T0.AddHours(1), canceller);

        var log = PaymentReceiptLog.Cancelled(Guid.NewGuid(), payment);

        log.Action.ShouldBe(ReceiptLogAction.Cancelled);
        log.At.ShouldBe(T0.AddHours(1));
        log.UserId.ShouldBe(canceller);
        log.CancelReasonCode.ShouldBe(PaymentCancelReason.WrongPayer);
        Should.Throw<ArgumentException>(() => PaymentReceiptLog.Cancelled(Guid.NewGuid(), Pending()));
    }

    [Fact]
    public void The_Ipad_Shows_The_Printed_Screen_For_A_While()
    {
        var session = ReceiptSigningSession.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "THANHTOAN-0001", T0);
        session.Close(SigningCloseReason.Printed, T0);

        session.ShowsIssued(T0.AddSeconds(10)).ShouldBeTrue();
        session.ShowsIssued(T0 + ReceiptSigningSession.IssuedShownFor).ShouldBeFalse();
    }

    [Fact]
    public void A_Saved_Signature_Is_Replaced_In_Place()
    {
        var user = Guid.NewGuid();
        var signature = AccountantSignature.Save(Guid.NewGuid(), user, "v1:a", AccountantSignatureSource.Drawn, T0);

        signature.Replace("v1:b", AccountantSignatureSource.Uploaded, T0.AddDays(1));

        signature.SignatureCipher.ShouldBe("v1:b");
        signature.Source.ShouldBe(AccountantSignatureSource.Uploaded);
        signature.Signer.ShouldBe(new ReceiptSigner(user, T0.AddDays(1)));
        Should.Throw<ArgumentException>(() => signature.Replace(" ", AccountantSignatureSource.Drawn, T0));
    }

    [Fact]
    public void An_Accountant_Signature_Past_Its_Cap_Gets_Its_Own_Error()
    {
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, .. new byte[100]];
        var dataUrl = SignatureImage.ToDataUrl(png);
        const string tooLarge = BlueDentalDomainErrorCodes.Billing.AccountantSignatureTooLarge;

        SignatureImage.FromDataUrl(dataUrl, png.Length, tooLarge).ShouldBe(png);
        Should.Throw<BusinessException>(() => SignatureImage.FromDataUrl(dataUrl, png.Length - 1, tooLarge))
            .Code.ShouldBe(tooLarge);
        Should.Throw<BusinessException>(() => SignatureImage.FromDataUrl("data:image/png;base64,QUJD", 1024, tooLarge))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.SignatureInvalid);
    }
}
