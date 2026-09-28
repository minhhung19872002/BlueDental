using System;
using System.Collections.Generic;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// BA item 24 — when a voucher's "Lượt dùng" moves. Measured on staging
/// 2026-09-28: the use is burnt as the slip opens, once per coupon, and the
/// coupon is pinned on the slip as it stood that day.
/// </summary>
public class TreatmentPlanVoucherTests
{
    private static readonly Guid BranchId = Guid.NewGuid();
    private static readonly Guid OtherBranchId = Guid.NewGuid();
    private static readonly DateOnly Today = new(2026, 9, 28);
    private static readonly IReadOnlyDictionary<Guid, int> NoPriorUses = new Dictionary<Guid, int>();

    private static TreatmentPlan OpenPlan(params decimal[] linePrices)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BranchId, "DT01", "Kế hoạch điều trị");
        foreach (var price in linePrices)
        {
            plan.AddService(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), price, 1, DiscountType.None, 0m);
        }

        return plan;
    }

    private static Voucher IssueVoucher(
        string code,
        DiscountType type = DiscountType.Money,
        decimal value = 200_000m,
        Guid? branchId = null,
        VoucherScopeTarget scope = VoucherScopeTarget.Treatment,
        decimal? maxDiscountAmount = null,
        bool isExclusive = false,
        int? usageLimit = null,
        int? perCustomerLimit = null,
        bool published = true)
    {
        var voucher = Voucher.Issue(
            Guid.NewGuid(), code, $"Voucher {code}", type, value,
            Today.AddDays(-1), Today.AddDays(30), scope,
            clinicBranchId: branchId ?? BranchId,
            maxDiscountAmount: maxDiscountAmount,
            isExclusive: isExclusive,
            usageLimit: usageLimit,
            perCustomerLimit: perCustomerLimit);

        if (published)
        {
            voucher.Publish();
        }

        return voucher;
    }

    private static BusinessException Refuses(TreatmentPlan plan, params Voucher[] vouchers) =>
        Refuses(plan, NoPriorUses, vouchers);

    private static BusinessException Refuses(
        TreatmentPlan plan, IReadOnlyDictionary<Guid, int> priorUses, params Voucher[] vouchers) =>
        Should.Throw<BusinessException>(() =>
            plan.RedeemVouchers(vouchers, priorUses, Today, Guid.NewGuid));

    [Fact]
    public void Redeeming_burns_one_use_per_voucher_and_pins_each_on_the_slip()
    {
        var plan = OpenPlan(2_000_000m, 1_000_000m);
        var money = IssueVoucher("GIAM200", DiscountType.Money, 200_000m);
        var percent = IssueVoucher("GIAM10", DiscountType.Percentage, 10m, maxDiscountAmount: 250_000m);

        plan.RedeemVouchers([money, percent], NoPriorUses, Today, Guid.NewGuid);

        money.UsedCount.ShouldBe(1);
        percent.UsedCount.ShouldBe(1);

        // 200.000 + min(10% × 3.000.000, 250.000) = 450.000.
        plan.VoucherDiscountAmount.ShouldBe(450_000m);
        plan.PlanDiscountAmount.ShouldBe(450_000m);
        plan.TotalAmount.ShouldBe(2_550_000m);

        plan.AppliedVouchers.Count.ShouldBe(2);
        var pinned = plan.AppliedVouchers.ToArray();
        pinned[0].VoucherId.ShouldBe(money.Id);
        pinned[0].Code.ShouldBe("GIAM200");
        pinned[0].Name.ShouldBe("Voucher GIAM200");
        pinned[0].DiscountType.ShouldBe(DiscountType.Money);
        pinned[0].DiscountValue.ShouldBe(200_000m);
        pinned[0].DiscountAmount.ShouldBe(200_000m);
        pinned[1].VoucherId.ShouldBe(percent.Id);
        pinned[1].MaxDiscountAmount.ShouldBe(250_000m);
        pinned[1].DiscountAmount.ShouldBe(250_000m);
        pinned[1].TreatmentPlanId.ShouldBe(plan.Id);
    }

    [Fact]
    public void The_last_use_flips_the_voucher_to_out_of_uses()
    {
        var plan = OpenPlan(1_000_000m);
        var voucher = IssueVoucher("CUOI", usageLimit: 1);

        plan.RedeemVouchers([voucher], NoPriorUses, Today, Guid.NewGuid);

        voucher.UsedCount.ShouldBe(1);
        voucher.IsExhausted.ShouldBeTrue();
        voucher.Status.ShouldBe(VoucherStatus.OutOfUses);
    }

    [Fact]
    public void A_voucher_that_cannot_apply_refuses_the_whole_pick_and_burns_nothing()
    {
        var plan = OpenPlan(1_000_000m);
        var fine = IssueVoucher("OK");
        var exhausted = IssueVoucher("HET", usageLimit: 1);
        OpenPlan(1_000_000m).RedeemVouchers([exhausted], NoPriorUses, Today, Guid.NewGuid);

        Refuses(plan, fine, exhausted).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        fine.UsedCount.ShouldBe(0);
        exhausted.UsedCount.ShouldBe(1);
        plan.AppliedVouchers.ShouldBeEmpty();
        plan.VoucherDiscountAmount.ShouldBeNull();
        plan.TotalAmount.ShouldBe(1_000_000m);
    }

    [Fact]
    public void An_unpublished_expired_or_too_small_order_is_refused_by_the_voucher_itself()
    {
        var unpublished = IssueVoucher("AN", published: false);
        Refuses(OpenPlan(1_000_000m), unpublished).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        var tooSmall = Voucher.Issue(
            Guid.NewGuid(), "TOI-THIEU", "Đơn tối thiểu", DiscountType.Money, 100_000m,
            Today.AddDays(-1), Today.AddDays(1), VoucherScopeTarget.Treatment,
            clinicBranchId: BranchId, minOrderValue: 5_000_000m);
        tooSmall.Publish();
        Refuses(OpenPlan(1_000_000m), tooSmall).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        var yesterday = Voucher.Issue(
            Guid.NewGuid(), "HOM-QUA", "Đã hết hạn", DiscountType.Money, 100_000m,
            Today.AddDays(-10), Today.AddDays(-1), VoucherScopeTarget.Treatment,
            clinicBranchId: BranchId);
        yesterday.Publish();
        Refuses(OpenPlan(1_000_000m), yesterday).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
    }

    [Fact]
    public void A_voucher_of_another_branch_is_refused_but_a_branchless_one_applies()
    {
        var plan = OpenPlan(1_000_000m);
        var elsewhere = IssueVoucher("CN-KHAC", branchId: OtherBranchId);
        Refuses(plan, elsewhere).Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        var everywhere = Voucher.Issue(
            Guid.NewGuid(), "MOI-NOI", "Toàn hệ thống", DiscountType.Money, 100_000m,
            Today.AddDays(-1), Today.AddDays(1), VoucherScopeTarget.Treatment);
        everywhere.Publish();
        plan.RedeemVouchers([everywhere], NoPriorUses, Today, Guid.NewGuid);

        everywhere.UsedCount.ShouldBe(1);
        plan.VoucherDiscountAmount.ShouldBe(100_000m);
    }

    [Fact]
    public void A_per_service_voucher_does_not_belong_on_the_slip()
    {
        var perService = IssueVoucher("DICH-VU", scope: VoucherScopeTarget.Service);

        Refuses(OpenPlan(1_000_000m), perService).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
        perService.UsedCount.ShouldBe(0);
    }

    [Fact]
    public void An_exclusive_voucher_stands_alone()
    {
        var exclusive = IssueVoucher("DOC-QUYEN", isExclusive: true);
        var other = IssueVoucher("KHAC");

        Refuses(OpenPlan(1_000_000m), exclusive, other).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
        exclusive.UsedCount.ShouldBe(0);
        other.UsedCount.ShouldBe(0);

        var alone = OpenPlan(1_000_000m);
        alone.RedeemVouchers([exclusive], NoPriorUses, Today, Guid.NewGuid);
        exclusive.UsedCount.ShouldBe(1);
    }

    [Fact]
    public void The_same_voucher_cannot_be_applied_twice_to_one_slip()
    {
        var voucher = IssueVoucher("HAI-LAN");

        Refuses(OpenPlan(1_000_000m), voucher, voucher).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
        voucher.UsedCount.ShouldBe(0);
    }

    [Fact]
    public void A_patient_at_the_per_customer_cap_is_refused()
    {
        var voucher = IssueVoucher("MOT-KHACH", perCustomerLimit: 1);

        var atCap = new Dictionary<Guid, int> { [voucher.Id] = 1 };
        Refuses(OpenPlan(1_000_000m), atCap, voucher).Code
            .ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherPerCustomerLimitReached);
        voucher.UsedCount.ShouldBe(0);

        var firstTime = new Dictionary<Guid, int> { [voucher.Id] = 0 };
        OpenPlan(1_000_000m).RedeemVouchers([voucher], firstTime, Today, Guid.NewGuid);
        voucher.UsedCount.ShouldBe(1);
    }

    [Fact]
    public void A_slip_redeems_once()
    {
        var plan = OpenPlan(1_000_000m);
        plan.RedeemVouchers([IssueVoucher("LAN-1")], NoPriorUses, Today, Guid.NewGuid);

        var again = IssueVoucher("LAN-2");
        Refuses(plan, again).Code.ShouldBe(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);
        again.UsedCount.ShouldBe(0);
        plan.AppliedVouchers.Count.ShouldBe(1);
    }

    [Fact]
    public void The_voucher_discount_never_exceeds_the_slip_total()
    {
        var plan = OpenPlan(500_000m);
        var big = IssueVoucher("LON", DiscountType.Money, 5_000_000m);

        plan.RedeemVouchers([big], NoPriorUses, Today, Guid.NewGuid);

        plan.VoucherDiscountAmount.ShouldBe(500_000m);
        plan.TotalAmount.ShouldBe(0m);
        plan.AppliedVouchers.ToArray()[0].DiscountAmount.ShouldBe(500_000m);
    }

    [Fact]
    public void No_voucher_picked_is_a_no_op()
    {
        var plan = OpenPlan(1_000_000m);

        plan.RedeemVouchers([], NoPriorUses, Today, Guid.NewGuid);

        plan.AppliedVouchers.ShouldBeEmpty();
        plan.VoucherDiscountAmount.ShouldBeNull();
    }
}
