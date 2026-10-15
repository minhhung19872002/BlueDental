using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// R-949 — a "Theo dịch vụ" voucher discounts only the lines whose service (or
/// the service's group) it targets. Owner decisions 2026-10-15: service
/// vouchers go first and the slip's own discount and whole-slip vouchers are
/// taken off what is left; one voucher matching several lines burns one use
/// and is spread over them by value; both kinds combine unless one is exclusive.
/// </summary>
public class TreatmentPlanServiceVoucherTests
{
    private static readonly Guid BranchId = Guid.NewGuid();
    private static readonly DateOnly Today = new(2026, 10, 15);
    private static readonly IReadOnlyDictionary<Guid, int> NoPriorUses = new Dictionary<Guid, int>();

    private static readonly Guid Whitening = Guid.NewGuid();
    private static readonly Guid Filling = Guid.NewGuid();
    private static readonly Guid Implant = Guid.NewGuid();
    private static readonly Guid CosmeticGroup = Guid.NewGuid();

    private static TreatmentPlan OpenPlan(params (Guid ServiceId, decimal Price)[] lines)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BranchId, "DT01", "Kế hoạch điều trị");
        foreach (var (serviceId, price) in lines)
        {
            plan.AddService(Guid.NewGuid(), serviceId, Guid.NewGuid(), price, 1, DiscountType.None, 0m);
        }

        return plan;
    }

    private static TreatmentService Line(TreatmentPlan plan, Guid serviceId) =>
        plan.Services.First(s => s.ServiceId == serviceId);

    private static Voucher Issue(
        string code,
        VoucherScopeTarget scope,
        List<Guid>? targets = null,
        DiscountType type = DiscountType.Money,
        decimal value = 100_000m,
        decimal? maxDiscountAmount = null,
        decimal? minOrderValue = null,
        bool isExclusive = false)
    {
        var voucher = Voucher.Issue(
            Guid.NewGuid(), code, $"Voucher {code}", type, value,
            Today.AddDays(-1), Today.AddDays(30), scope,
            clinicBranchId: BranchId,
            targetIds: targets,
            maxDiscountAmount: maxDiscountAmount,
            minOrderValue: minOrderValue,
            isExclusive: isExclusive);
        voucher.Publish();
        return voucher;
    }

    private static Voucher ForServices(string code, List<Guid> targets, DiscountType type = DiscountType.Money,
        decimal value = 100_000m, decimal? minOrderValue = null, bool isExclusive = false) =>
        Issue(code, VoucherScopeTarget.Service, targets, type, value, minOrderValue: minOrderValue, isExclusive: isExclusive);

    private static Voucher ForSlip(string code, DiscountType type = DiscountType.Money, decimal value = 100_000m,
        bool isExclusive = false) =>
        Issue(code, VoucherScopeTarget.Treatment, type: type, value: value, isExclusive: isExclusive);

    private static void Redeem(TreatmentPlan plan, IReadOnlyDictionary<Guid, Guid>? groups, params Voucher[] vouchers) =>
        plan.RedeemVouchers(vouchers, NoPriorUses, Today, Guid.NewGuid, groups);

    private static BusinessException Refuses(TreatmentPlan plan, params Voucher[] vouchers) =>
        Should.Throw<BusinessException>(() => Redeem(plan, null, vouchers));

    /// <summary>Every money figure of a slip agrees with every other one.</summary>
    private static void ShouldAddUp(TreatmentPlan plan)
    {
        plan.Services.Sum(plan.ChargedAmountOf).ShouldBe(plan.TotalAmount);
        (plan.ServicesGrossTotal - plan.TotalDiscountAmount).ShouldBe(plan.TotalAmount);
        plan.DiscountShares().Values.Sum().ShouldBe(plan.PlanDiscountAmount);
    }

    [Fact]
    public void Only_the_line_the_voucher_targets_is_discounted()
    {
        // The BA's case: two services ticked, the voucher is for Tẩy trắng only.
        var plan = OpenPlan((Whitening, 2_000_000m), (Filling, 500_000m));
        var voucher = ForServices("TAY-TRANG", [Whitening], DiscountType.Percentage, 10m);

        Redeem(plan, null, voucher);

        voucher.UsedCount.ShouldBe(1);
        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(200_000m);
        plan.ServiceVoucherOf(Line(plan, Filling)).ShouldBe(0m);
        plan.ChargedAmountOf(Line(plan, Whitening)).ShouldBe(1_800_000m);
        plan.ChargedAmountOf(Line(plan, Filling)).ShouldBe(500_000m);

        plan.ServiceVoucherTotal.ShouldBe(200_000m);
        plan.VoucherDiscountAmount.ShouldBeNull();
        plan.PlanDiscountAmount.ShouldBe(0m);
        plan.TotalDiscountAmount.ShouldBe(200_000m);
        plan.TotalAmount.ShouldBe(2_300_000m);

        var pinned = plan.AppliedVouchers.Single();
        pinned.ScopeTarget.ShouldBe(VoucherScopeTarget.Service);
        pinned.DiscountAmount.ShouldBe(200_000m);
        ShouldAddUp(plan);
    }

    [Fact]
    public void A_voucher_naming_the_group_reaches_the_services_in_it()
    {
        var plan = OpenPlan((Whitening, 2_000_000m), (Filling, 500_000m));
        var groups = new Dictionary<Guid, Guid> { [Whitening] = CosmeticGroup, [Filling] = Guid.NewGuid() };
        var voucher = ForServices("THAM-MY", [CosmeticGroup], DiscountType.Percentage, 10m);

        Redeem(plan, groups, voucher);

        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(200_000m);
        plan.ServiceVoucherOf(Line(plan, Filling)).ShouldBe(0m);
        plan.TotalAmount.ShouldBe(2_300_000m);
    }

    [Fact]
    public void The_percentage_and_its_cap_are_measured_on_the_matching_lines_only()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 3_000_000m));
        var capped = Issue("TRAN", VoucherScopeTarget.Service, [Whitening],
            DiscountType.Percentage, 50m, maxDiscountAmount: 300_000m);

        Redeem(plan, null, capped);

        // 50% of 1.000.000 is 500.000, capped at 300.000 — never 50% of the slip.
        plan.ServiceVoucherTotal.ShouldBe(300_000m);
        plan.TotalAmount.ShouldBe(3_700_000m);
    }

    [Fact]
    public void A_minimum_order_is_measured_on_the_matching_lines_not_the_slip()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 3_000_000m));
        var voucher = ForServices("TOI-THIEU", [Whitening], minOrderValue: 1_500_000m);

        Refuses(plan, voucher).Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
        voucher.UsedCount.ShouldBe(0);
        plan.AppliedVouchers.ShouldBeEmpty();
    }

    [Fact]
    public void One_voucher_on_several_lines_burns_one_use_and_is_split_by_value()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 2_000_000m), (Implant, 5_000_000m));
        var voucher = ForServices("HAI-DV", [Whitening, Filling], DiscountType.Money, 300_000m);

        Redeem(plan, null, voucher);

        voucher.UsedCount.ShouldBe(1);
        plan.AppliedVouchers.Count.ShouldBe(1);
        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(100_000m);
        plan.ServiceVoucherOf(Line(plan, Filling)).ShouldBe(200_000m);
        plan.ServiceVoucherOf(Line(plan, Implant)).ShouldBe(0m);
        plan.TotalAmount.ShouldBe(7_700_000m);
        ShouldAddUp(plan);
    }

    [Fact]
    public void The_split_adds_up_to_the_voucher_in_whole_dong()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 1_000_000m), (Implant, 1_000_000m));
        var voucher = ForServices("CHIA-BA", [Whitening, Filling, Implant], DiscountType.Money, 100_000m);

        Redeem(plan, null, voucher);

        var parts = plan.Services.Select(plan.ServiceVoucherOf).ToList();
        parts.Sum().ShouldBe(100_000m);
        parts.ShouldAllBe(p => p == decimal.Truncate(p));
        parts.OrderBy(p => p).ShouldBe([33_333m, 33_333m, 33_334m]);
        ShouldAddUp(plan);
    }

    [Fact]
    public void A_service_voucher_bigger_than_its_line_only_takes_the_line()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 500_000m));
        var voucher = ForServices("LON", [Whitening], DiscountType.Money, 5_000_000m);

        Redeem(plan, null, voucher);

        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(1_000_000m);
        plan.ChargedAmountOf(Line(plan, Whitening)).ShouldBe(0m);
        plan.AppliedVouchers.Single().DiscountAmount.ShouldBe(1_000_000m);
        plan.TotalAmount.ShouldBe(500_000m);
    }

    [Fact]
    public void Two_service_vouchers_on_one_line_the_second_takes_from_what_is_left()
    {
        var plan = OpenPlan((Whitening, 1_000_000m));
        var first = ForServices("TRU-300", [Whitening], DiscountType.Money, 300_000m);
        var second = ForServices("NUA", [Whitening], DiscountType.Percentage, 50m);

        Redeem(plan, null, first, second);

        plan.AppliedVouchers.Select(v => v.DiscountAmount).ShouldBe([300_000m, 350_000m]);
        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(650_000m);
        plan.TotalAmount.ShouldBe(350_000m);
    }

    [Fact]
    public void Service_vouchers_go_first_and_the_slip_discounts_take_from_what_is_left()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 2_000_000m));
        plan.ApplyDiscount(DiscountType.Percentage, 10m);
        var service = ForServices("DV-10", [Whitening], DiscountType.Percentage, 10m);
        var slip = ForSlip("KHDT-10", DiscountType.Percentage, 10m);

        // Ticked slip-first: the order of the pick never changes the money.
        Redeem(plan, null, slip, service);

        service.UsedCount.ShouldBe(1);
        slip.UsedCount.ShouldBe(1);

        // 10% of Tẩy trắng = 100.000; the rest is 2.900.000.
        plan.ServiceVoucherTotal.ShouldBe(100_000m);
        plan.PlanBase.ShouldBe(2_900_000m);
        // Slip voucher 10% of 2.900.000 and the slip's own 10% of 2.900.000.
        plan.VoucherDiscountAmount.ShouldBe(290_000m);
        plan.OwnDiscountUncapped.ShouldBe(290_000m);
        plan.PlanDiscountAmount.ShouldBe(580_000m);
        plan.TotalAmount.ShouldBe(2_320_000m);

        // The slip discount is spread on 900.000 : 2.000.000.
        plan.ChargedAmountOf(Line(plan, Whitening)).ShouldBe(720_000m);
        plan.ChargedAmountOf(Line(plan, Filling)).ShouldBe(1_600_000m);

        // The pick is pinned in the order it was ticked.
        plan.AppliedVouchers.Select(v => v.ScopeTarget)
            .ShouldBe([VoucherScopeTarget.Treatment, VoucherScopeTarget.Service]);
        plan.AppliedVouchers.Select(v => v.DiscountAmount).ShouldBe([290_000m, 100_000m]);
        // … and numbered, so the order survives a read back from the database.
        plan.AppliedVouchers.Select(v => v.Position).ShouldBe([0, 1]);

        var parts = plan.DiscountShareParts();
        parts.Values.Sum(p => p.Voucher).ShouldBe(290_000m);
        parts.Values.Sum(p => p.Own).ShouldBe(290_000m);
        ShouldAddUp(plan);
    }

    [Fact]
    public void An_exclusive_voucher_stands_alone_across_both_kinds()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 2_000_000m));
        var exclusiveService = ForServices("DQ-DV", [Whitening], isExclusive: true);
        var slip = ForSlip("KHDT");

        Refuses(plan, exclusiveService, slip).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        var exclusiveSlip = ForSlip("DQ-KHDT", isExclusive: true);
        var service = ForServices("DV", [Whitening]);
        Refuses(plan, service, exclusiveSlip).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        new[] { exclusiveService, slip, exclusiveSlip, service }.ShouldAllBe(v => v.UsedCount == 0);
        plan.AppliedVouchers.ShouldBeEmpty();

        Redeem(plan, null, exclusiveService);
        exclusiveService.UsedCount.ShouldBe(1);
    }

    [Fact]
    public void A_refused_slip_voucher_burns_no_service_voucher_either()
    {
        var plan = OpenPlan((Whitening, 1_000_000m));
        var service = ForServices("DV", [Whitening]);
        var tooBig = Voucher.Issue(
            Guid.NewGuid(), "TOI-THIEU", "Đơn tối thiểu", DiscountType.Money, 100_000m,
            Today.AddDays(-1), Today.AddDays(1), VoucherScopeTarget.Treatment,
            clinicBranchId: BranchId, minOrderValue: 950_000m);
        tooBig.Publish();

        // The slip voucher is measured after the service one: 900.000 < 950.000.
        Refuses(plan, service, tooBig).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        service.UsedCount.ShouldBe(0);
        plan.ServiceVoucherTotal.ShouldBe(0m);
        plan.AppliedVouchers.ShouldBeEmpty();
    }

    [Fact]
    public void Cancelling_the_discounted_line_drops_its_voucher_but_not_the_use()
    {
        var plan = OpenPlan((Whitening, 2_000_000m), (Filling, 500_000m));
        var voucher = ForServices("TAY-TRANG", [Whitening], DiscountType.Money, 300_000m);
        Redeem(plan, null, voucher);

        Line(plan, Whitening).Cancel();

        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(0m);
        plan.ServiceVoucherTotal.ShouldBe(0m);
        plan.TotalAmount.ShouldBe(500_000m);
        voucher.UsedCount.ShouldBe(1);
        plan.AppliedVouchers.Single().DiscountAmount.ShouldBe(300_000m);
        ShouldAddUp(plan);
    }

    [Fact]
    public void A_line_cheapened_below_its_voucher_is_charged_nothing_never_less()
    {
        var plan = OpenPlan((Whitening, 1_000_000m), (Filling, 500_000m));
        Redeem(plan, null, ForServices("TRU-800", [Whitening], DiscountType.Money, 800_000m));

        Line(plan, Whitening).Revise(600_000m, 1, [], null, 0m, new HashSet<int>());

        plan.ServiceVoucherOf(Line(plan, Whitening)).ShouldBe(600_000m);
        plan.ChargedAmountOf(Line(plan, Whitening)).ShouldBe(0m);
        plan.TotalAmount.ShouldBe(500_000m);
        ShouldAddUp(plan);
    }

    [Fact]
    public void The_money_rollup_counts_the_service_voucher_as_discount()
    {
        var plan = OpenPlan((Whitening, 2_000_000m), (Filling, 500_000m));
        Redeem(plan, null, ForServices("TAY-TRANG", [Whitening], DiscountType.Money, 300_000m));

        var summary = new PatientMoneyCalculator().ForPlan(plan, []);

        summary.Discount.ShouldBe(300_000m);
        summary.TotalPrice.ShouldBe(2_200_000m);
    }

    [Fact]
    public void Finished_work_is_valued_after_its_service_voucher()
    {
        var plan = OpenPlan((Whitening, 2_000_000m), (Filling, 500_000m));
        Redeem(plan, null, ForServices("TAY-TRANG", [Whitening], DiscountType.Money, 300_000m));

        Line(plan, Whitening).Start();
        Line(plan, Whitening).Complete();

        plan.CompletedValue.ShouldBe(1_700_000m);
    }
}
