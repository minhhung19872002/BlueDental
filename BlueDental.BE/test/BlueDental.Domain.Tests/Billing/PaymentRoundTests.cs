using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>
/// P2910 (F-83): a slip paid over several đợt. TN giảm and the payment-time
/// voucher come off before VAT; each đợt carries the VAT inside its money and
/// the đợt that clears a line takes what is left of the line's VAT, so the đợt
/// add up to the VAT after every relief (BA + owner 2026-10-29).
/// </summary>
public class PaymentRoundTests
{
    private static readonly DateOnly Today = new(2026, 10, 29);
    private static readonly IReadOnlyDictionary<Guid, LineSettlement> Unpaid = new Dictionary<Guid, LineSettlement>();

    private static TreatmentPlan Open() =>
        TreatmentPlan.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch điều trị");

    private static TreatmentService Line(TreatmentPlan plan, decimal price, ServiceTaxRate rate = ServiceTaxRate.NotTaxable) =>
        plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, price, 1, DiscountType.None, 0m).StampTaxRate(rate);

    private static PaymentRound Round(
        TreatmentPlan plan,
        IReadOnlyDictionary<Guid, LineSettlement> before,
        IEnumerable<TreatmentService> lines,
        params (TreatmentService Line, decimal Discount)[] discounts) =>
        new(plan, before, lines.Select(line => line.Id).ToList(),
            discounts.ToDictionary(d => d.Line.Id, d => new PaymentLineTerms(null, d.Discount, null)));

    private static Dictionary<Guid, decimal> Cash(params (TreatmentService Line, decimal Amount)[] cash) =>
        cash.ToDictionary(c => c.Line.Id, c => c.Amount);

    private static PatientPayment Paid(
        TreatmentPlan plan, IReadOnlyCollection<PaymentLineDraft> drafts, PaymentVoucherUse? voucher = null) =>
        PatientPayment.Record(
            Guid.NewGuid(), plan.PatientId, plan.BranchId, PatientPaymentKind.Payment, PaymentMethodKind.Cash,
            drafts.Sum(d => d.Amount), "PT26-0001", Guid.NewGuid(), DateTimeOffset.UtcNow,
            treatmentPlanId: plan.Id, lines: drafts, voucher: voucher);

    private static Voucher AVoucher(
        DiscountType type,
        decimal value,
        VoucherScopeTarget scope = VoucherScopeTarget.Treatment,
        List<Guid>? targets = null,
        Guid? branchId = null,
        bool exclusive = false,
        int? perCustomerLimit = null) =>
        Voucher.Issue(
            Guid.NewGuid(), "TT26", "Ưu đãi thanh toán", type, value,
            new DateOnly(2026, 10, 1), new DateOnly(2026, 12, 31), scope,
            clinicBranchId: branchId, targetIds: targets, isExclusive: exclusive,
            perCustomerLimit: perCustomerLimit).Publish();

    private static PaymentVoucherUse Use(PaymentRound round, Voucher voucher, int priorUses = 0, bool held = false) =>
        round.UseVoucher(voucher, Today, priorUses, [], null, held);

    [Fact]
    public void The_BA_example_two_rounds_add_up_to_the_VAT_after_relief()
    {
        // Giá sau BS giảm 10.000.000, VAT 10 %.
        var plan = Open();
        var line = Line(plan, 10_000_000m, ServiceTaxRate.Ten);

        var first = Round(plan, Unpaid, [line]);
        first.Caps()[line.Id].ShouldBe(11_000_000m);
        var firstDrafts = first.Drafts(Cash((line, 5_500_000m)));
        firstDrafts.Single().TaxAmount.ShouldBe(500_000m);
        var payments = new List<PatientPayment> { Paid(plan, firstDrafts) };

        // Đợt 2: TN giảm 1.000.000 → VAT cả DV 900.000, còn nợ 9.000.000 + 900.000 − 5.500.000.
        var second = Round(plan, LineSettlement.Of(plan, payments), [line], (line, 1_000_000m));
        second.Caps()[line.Id].ShouldBe(4_400_000m);
        var secondDrafts = second.Drafts(Cash((line, 4_400_000m)));
        secondDrafts.Single().TaxAmount.ShouldBe(400_000m);
        secondDrafts.Single().CashierDiscount.ShouldBe(1_000_000m);
        payments.Add(Paid(plan, secondDrafts));

        var settled = LineSettlement.Of(plan, payments);
        settled[line.Id].Tax.ShouldBe(900_000m);
        settled[line.Id].Tax.ShouldBe(plan.TaxAmountOf(line, settled[line.Id].Relief));
        plan.OutstandingOf(line, settled[line.Id]).ShouldBe(0m);
        // "Ưu đãi khi thanh toán": the 1.000.000 off and the 100.000 VAT that went with it.
        plan.ReliefOffPayable(settled).ShouldBe(1_100_000m);
        plan.ReliefOn(settled).ShouldBe(1_000_000m);
    }

    [Fact]
    public void Khuyen_mai_on_the_slip_head_is_the_relief_of_paid_receipts_before_VAT()
    {
        // P0111_02 (R-1104): BA — VAT sits in the price and belongs to Công nợ.
        var plan = Open();
        var taxed = Line(plan, 10_000_000m, ServiceTaxRate.Ten);
        var plain = Line(plan, 2_000_000m);
        var money = new PatientMoneyCalculator();

        money.ForPlan(plan, []).Promotion.ShouldBe(0m);

        var drafts = Round(plan, Unpaid, [taxed, plain], (taxed, 1_000_000m), (plain, 200_000m))
            .Drafts(Cash((taxed, 4_400_000m), (plain, 1_800_000m)));
        var payments = new List<PatientPayment> { Paid(plan, drafts) };

        var slip = money.ForPlan(plan, payments);
        slip.Promotion.ShouldBe(1_200_000m);
        slip.Relief.ShouldBe(1_300_000m);
        money.ForLines(plan, new HashSet<Guid> { plain.Id }, payments).Promotion.ShouldBe(200_000m);
        money.ForPatient([plan], payments).Promotion.ShouldBe(1_200_000m);
    }

    [Fact]
    public void The_rounding_left_over_lands_on_the_round_that_clears_the_line()
    {
        var plan = Open();
        var line = Line(plan, 1_000_000m, ServiceTaxRate.Eight);
        var payments = new List<PatientPayment>();
        var taxes = new List<decimal?>();

        foreach (var amount in new[] { 333_333m, 333_333m, 413_334m })
        {
            var drafts = Round(plan, LineSettlement.Of(plan, payments), [line]).Drafts(Cash((line, amount)));
            taxes.Add(drafts.Single().TaxAmount);
            payments.Add(Paid(plan, drafts));
        }

        // 333.333 × 8/108 = 24.691,33 each; the last takes 80.000 − 49.382, not 30.617.
        taxes.ShouldBe([24_691m, 24_691m, 30_618m]);
        LineSettlement.Of(plan, payments)[line.Id].Tax.ShouldBe(plan.TaxAmountOf(line));
    }

    [Fact]
    public void An_untaxed_line_carries_no_VAT_in_any_round()
    {
        var plan = Open();
        var line = Line(plan, 2_000_000m);

        var drafts = Round(plan, Unpaid, [line], (line, 500_000m)).Drafts(Cash((line, 1_500_000m)));

        drafts.Single().TaxAmount.ShouldBe(0m);
        Round(plan, Unpaid, [line], (line, 500_000m)).Caps()[line.Id].ShouldBe(1_500_000m);
    }

    [Fact]
    public void A_percent_voucher_is_taken_on_the_pre_VAT_debt_even_when_paying_part()
    {
        // Owner 2026-10-29: còn nợ 20tr, voucher 10 % → giảm 2tr.
        var plan = Open();
        var line = Line(plan, 20_000_000m, ServiceTaxRate.Ten);
        var round = Round(plan, Unpaid, [line]);

        var use = Use(round, AVoucher(DiscountType.Percentage, 10m));

        var draft = round.Drafts(Cash((line, 5_000_000m))).Single();
        draft.VoucherShare.ShouldBe(2_000_000m);
        round.Caps()[line.Id].ShouldBe(19_800_000m);
        Paid(plan, [draft], use).VoucherAmount.ShouldBe(2_000_000m);
    }

    [Fact]
    public void The_voucher_base_is_what_is_left_after_earlier_rounds_and_this_rounds_TN()
    {
        var plan = Open();
        var line = Line(plan, 20_000_000m, ServiceTaxRate.Ten);
        var payments = new List<PatientPayment>
        {
            Paid(plan, Round(plan, Unpaid, [line]).Drafts(Cash((line, 2_200_000m))))
        };

        // 18tr before VAT still owed, 2tr of it let off by TN → 10 % of 16tr.
        var round = Round(plan, LineSettlement.Of(plan, payments), [line], (line, 2_000_000m));
        Use(round, AVoucher(DiscountType.Percentage, 10m));

        round.Drafts(Cash((line, 0m))).Single().VoucherShare.ShouldBe(1_600_000m);
    }

    [Fact]
    public void A_voucher_splits_evenly_with_the_odd_dong_on_the_last_line()
    {
        var plan = Open();
        var lines = new[] { Line(plan, 1_000_000m), Line(plan, 1_000_000m), Line(plan, 1_000_000m) };
        var round = Round(plan, Unpaid, lines);

        Use(round, AVoucher(DiscountType.Money, 100_001m));

        round.Drafts(lines.ToDictionary(l => l.Id, _ => 100_000m))
            .Select(d => d.VoucherShare)
            .ShouldBe([33_333m, 33_333m, 33_335m]);
    }

    [Fact]
    public void What_a_line_has_no_room_for_moves_to_the_others()
    {
        var plan = Open();
        var small = Line(plan, 100_000m);
        var big = Line(plan, 1_000_000m);
        var round = Round(plan, Unpaid, [small, big]);

        Use(round, AVoucher(DiscountType.Money, 300_000m));

        var drafts = round.Drafts(Cash((big, 700_000m)));
        drafts.Single(d => d.TreatmentServiceId == small.Id).VoucherShare.ShouldBe(100_000m);
        drafts.Single(d => d.TreatmentServiceId == big.Id).VoucherShare.ShouldBe(200_000m);
        round.Caps()[small.Id].ShouldBe(0m);
    }

    [Fact]
    public void A_service_voucher_reaches_only_its_target_lines()
    {
        var plan = Open();
        var target = Line(plan, 1_000_000m);
        var other = Line(plan, 1_000_000m);
        var round = Round(plan, Unpaid, [target, other]);

        Use(round, AVoucher(DiscountType.Money, 400_000m, VoucherScopeTarget.Service, [target.ServiceId]));

        var drafts = round.Drafts(Cash((target, 100_000m), (other, 100_000m)));
        drafts.Single(d => d.TreatmentServiceId == target.Id).VoucherShare.ShouldBe(400_000m);
        drafts.Single(d => d.TreatmentServiceId == other.Id).VoucherShare.ShouldBe(0m);
    }

    [Fact]
    public void A_held_voucher_is_not_burnt_again_and_the_customer_limit_counts_other_uses()
    {
        var plan = Open();
        var line = Line(plan, 1_000_000m);
        var voucher = AVoucher(DiscountType.Money, 100_000m, perCustomerLimit: 1);

        Should.Throw<BusinessException>(() => Use(Round(plan, Unpaid, [line]), voucher, priorUses: 1))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherPerCustomerLimitReached);
        voucher.UsedCount.ShouldBe(0);

        Use(Round(plan, Unpaid, [line]), voucher);
        voucher.UsedCount.ShouldBe(1);

        // Revising the receipt with its voucher still on reads the discount, takes no new use.
        Use(Round(plan, Unpaid, [line]), voucher, priorUses: 1, held: true);
        voucher.UsedCount.ShouldBe(1);
    }

    [Fact]
    public void A_voucher_of_another_branch_or_beside_an_exclusive_one_is_refused()
    {
        var plan = Open();
        var line = Line(plan, 1_000_000m);

        Should.Throw<BusinessException>(() =>
                Use(Round(plan, Unpaid, [line]), AVoucher(DiscountType.Money, 1_000m, branchId: Guid.NewGuid())))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        Should.Throw<BusinessException>(() =>
                Round(plan, Unpaid, [line]).UseVoucher(
                    AVoucher(DiscountType.Money, 1_000m, exclusive: true), Today, 0,
                    [AVoucher(DiscountType.Money, 1_000m)], null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
    }

    [Fact]
    public void TN_cannot_take_more_than_the_line_owes_before_VAT()
    {
        var plan = Open();
        var line = Line(plan, 1_000_000m, ServiceTaxRate.Ten);

        Should.Throw<BusinessException>(() => Round(plan, Unpaid, [line], (line, 1_000_001m)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.ReliefExceedsOutstanding);
    }

    [Fact]
    public void A_line_let_off_whole_makes_a_zero_dong_receipt()
    {
        var plan = Open();
        var freed = Line(plan, 1_000_000m, ServiceTaxRate.Ten);
        var untouched = Line(plan, 500_000m);
        var round = Round(plan, Unpaid, [freed, untouched], (freed, 1_000_000m));

        round.Caps()[freed.Id].ShouldBe(0m);
        var drafts = round.Drafts(Cash());

        // The untouched line, with neither money nor relief, is left off the receipt.
        drafts.Single().TreatmentServiceId.ShouldBe(freed.Id);
        drafts.Single().TaxAmount.ShouldBe(0m);
        var receipt = Paid(plan, drafts);
        receipt.Amount.ShouldBe(0m);
        receipt.Relief.ShouldBe(1_000_000m);
        plan.OutstandingOf(freed, LineSettlement.Of(plan, [receipt])[freed.Id]).ShouldBe(0m);
    }

    [Fact]
    public void Only_the_receipts_handed_in_settle_a_line()
    {
        // The ISettleable filter keeps a pending receipt out of the list, so its
        // TN giảm lets nothing off until it is paid.
        var plan = Open();
        var line = Line(plan, 1_000_000m, ServiceTaxRate.Ten);

        LineSettlement.Of(plan, []).ShouldBeEmpty();
        plan.OutstandingOf(line, LineSettlement.None).ShouldBe(1_100_000m);
        plan.ReliefOffPayable(Unpaid).ShouldBe(0m);
    }
}
