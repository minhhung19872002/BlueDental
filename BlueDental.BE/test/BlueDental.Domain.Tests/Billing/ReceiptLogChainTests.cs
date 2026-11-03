using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using BlueDental.Billing;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>
/// R-1082: each receipt log line is sealed to the one before it, so a line
/// changed, dropped or forged without the vault key shows when the log is read.
/// </summary>
public class ReceiptLogChainTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly IReceiptCipher Vault = CipherOf(RandomNumberGenerator.GetBytes(32));

    [Fact]
    public void A_Receipt_Log_Read_Back_As_Written_Is_Intact()
    {
        var lines = Chain();

        var check = ReceiptLogChain.Check(lines, Vault);

        check.Intact.ShouldBeTrue();
        check.UnsealedCount.ShouldBe(0);
        check.Verified.ShouldBe(lines.Select(x => x.Id), ignoreOrder: true);
        lines.Select(x => x.Sequence).ShouldBe([1, 2, 3, 4]);
        lines.ShouldAllBe(x => x.Seal!.StartsWith("v1:") && x.Seal.Length == 3 + 64);
        lines.Select(x => x.Seal).Distinct().Count().ShouldBe(4);
    }

    [Fact]
    public void A_Changed_Line_No_Longer_Verifies()
    {
        var lines = Chain();
        Tamper(lines[2], nameof(PaymentReceiptLog.UserId), Guid.NewGuid());

        var check = ReceiptLogChain.Check(lines, Vault);

        check.Intact.ShouldBeFalse();
        check.Verified.ShouldBe([lines[0].Id, lines[1].Id, lines[3].Id], ignoreOrder: true);
    }

    [Fact]
    public void A_Changed_Time_No_Longer_Verifies()
    {
        var lines = Chain();
        Tamper(lines[2], nameof(PaymentReceiptLog.At), lines[2].At.AddMinutes(-30));

        ReceiptLogChain.Check(lines, Vault).Verified.ShouldNotContain(lines[2].Id);
    }

    [Fact]
    public void A_Line_Dropped_From_The_Middle_Or_The_Start_Breaks_The_Chain()
    {
        var lines = Chain();

        var middle = ReceiptLogChain.Check([lines[0], lines[2], lines[3]], Vault);
        middle.Intact.ShouldBeFalse();
        middle.Verified.ShouldNotContain(lines[2].Id);

        var start = ReceiptLogChain.Check(lines.Skip(1).ToList(), Vault);
        start.Intact.ShouldBeFalse();
        start.Verified.ShouldNotContain(lines[1].Id);
    }

    [Fact]
    public void A_Line_Sealed_With_Another_Key_Does_Not_Verify()
    {
        var lines = Chain();
        var payment = PaymentOf(lines[0]);
        var forged = PaymentReceiptLog.PaperTakenBack(Guid.NewGuid(), payment, T0.AddHours(2), Guid.NewGuid());
        forged.SealAfter(lines[^1], CipherOf(RandomNumberGenerator.GetBytes(32)));

        var check = ReceiptLogChain.Check([.. lines, forged], Vault);

        check.Intact.ShouldBeFalse();
        check.Verified.ShouldNotContain(forged.Id);
    }

    [Fact]
    public void Unsealed_Lines_Are_Counted_And_Allowed_Only_Ahead_Of_The_Sealed_Ones()
    {
        var payment = Pending();
        payment.SignOnPaper(T0, Guid.NewGuid());
        var legacy = PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), payment);
        Tamper(legacy, nameof(PaymentReceiptLog.Sequence), 1);
        var sealedLine = PaymentReceiptLog.PaperTakenBack(Guid.NewGuid(), payment, T0.AddMinutes(1), null);
        sealedLine.SealAfter(legacy, Vault);

        var upgraded = ReceiptLogChain.Check([legacy, sealedLine], Vault);
        upgraded.Intact.ShouldBeTrue();
        upgraded.UnsealedCount.ShouldBe(1);
        upgraded.Verified.ShouldBe([sealedLine.Id]);

        var slippedIn = PaymentReceiptLog.PaperTakenBack(Guid.NewGuid(), payment, T0.AddMinutes(2), null);
        Tamper(slippedIn, nameof(PaymentReceiptLog.Sequence), 3);
        ReceiptLogChain.Check([legacy, sealedLine, slippedIn], Vault).Intact.ShouldBeFalse();
    }

    [Fact]
    public void Times_Are_Kept_In_Utc_To_The_Microsecond_As_The_Database_Keeps_Them()
    {
        var payment = Pending();
        var printedAt = new DateTimeOffset(2026, 10, 29, 10, 0, 0, TimeSpan.FromHours(7)).AddTicks(1_234_567);
        payment.SignOnPaper(printedAt, Guid.NewGuid());

        var line = PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), payment);

        line.At.Offset.ShouldBe(TimeSpan.Zero);
        line.At.UtcTicks.ShouldBe(printedAt.UtcTicks - 7);
    }

    [Fact]
    public void A_Line_Is_Sealed_Once_And_Only_After_Its_Own_Receipt()
    {
        var lines = Chain();
        Should.Throw<InvalidOperationException>(() => lines[1].SealAfter(lines[0], Vault));

        var other = Pending();
        other.SignOnPaper(T0, Guid.NewGuid());
        var stranger = PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), other);
        Should.Throw<ArgumentException>(() => stranger.SealAfter(lines[^1], Vault));
    }

    [Fact]
    public void The_Mac_Depends_On_Text_And_Key()
    {
        var mac = Vault.Mac("dòng 1");

        Vault.Mac("dòng 1").ShouldBe(mac);
        Vault.MacMatches("dòng 1", mac).ShouldBeTrue();
        Vault.MacMatches("dòng 2", mac).ShouldBeFalse();
        Vault.MacMatches("dòng 1", mac[..^1]).ShouldBeFalse();
        CipherOf(RandomNumberGenerator.GetBytes(32)).Mac("dòng 1").ShouldNotBe(mac);
    }

    /// <summary>Printed for paper → taken back → exported → cancelled, each sealed to the one before.</summary>
    private static List<PaymentReceiptLog> Chain()
    {
        var payment = Pending();
        payment.SignOnPaper(T0, Guid.NewGuid());
        var printed = PaymentReceiptLog.PrintedForPaper(Guid.NewGuid(), payment);
        payment.TakeBackPaper();
        var takenBack = PaymentReceiptLog.PaperTakenBack(Guid.NewGuid(), payment, T0.AddMinutes(1), Guid.NewGuid());
        payment.Issue(T0.AddMinutes(5), Guid.NewGuid(), ReceiptSignMode.Unsigned, "receipts/b/p.pdf.enc", new string('c', 64));
        var exported = PaymentReceiptLog.Exported(Guid.NewGuid(), payment, customerSignedAt: T0.AddMinutes(4));
        payment.Cancel(PaymentCancelReason.WrongPayer, "sai tên", T0.AddHours(1), Guid.NewGuid());
        var cancelled = PaymentReceiptLog.Cancelled(Guid.NewGuid(), payment);

        List<PaymentReceiptLog> lines = [printed, takenBack, exported, cancelled];
        PaymentReceiptLog? previous = null;
        foreach (var line in lines)
        {
            line.SealAfter(previous, Vault);
            previous = line;
        }

        return lines;
    }

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
            lines: [(Guid.NewGuid(), 1_000_000m)],
            status: PatientPaymentStatus.Pending);

    /// <summary>A receipt with the same id and branch as the line's, so a new line belongs to the same log.</summary>
    private static PatientPayment PaymentOf(PaymentReceiptLog line)
    {
        var payment = Pending();
        Tamper(payment, nameof(PatientPayment.Id), line.PatientPaymentId);
        Tamper(payment, nameof(PatientPayment.ClinicBranchId), line.ClinicBranchId);
        return payment;
    }

    /// <summary>What an UPDATE straight on the table would do.</summary>
    private static void Tamper(object entity, string property, object value)
    {
        var type = entity.GetType();
        while (type.GetProperty(property)?.SetMethod == null)
        {
            type = type.BaseType!;
        }

        type.GetProperty(property)!.SetValue(entity, value);
    }

    private static AesGcmReceiptCipher CipherOf(byte[] key) =>
        new(Options.Create(new ReceiptVaultOptions { Key = Convert.ToBase64String(key) }));
}
