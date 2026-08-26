using System;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Promotions;

public class VoucherTests
{
    private readonly DateOnly _from = new(2026, 8, 1);
    private readonly DateOnly _to = new(2026, 8, 31);
    private readonly DateOnly _inWindow = new(2026, 8, 15);

    private Voucher Issue(
        DiscountType discountType = DiscountType.Percentage,
        decimal discountValue = 10m,
        decimal? maxDiscountAmount = null,
        decimal? minOrderValue = null,
        int? usageLimit = null)
    {
        return Voucher.Issue(
            Guid.NewGuid(), "SUM26", "Khuyến mãi hè", discountType, discountValue,
            _from, _to, VoucherScopeTarget.Treatment,
            maxDiscountAmount: maxDiscountAmount,
            minOrderValue: minOrderValue,
            usageLimit: usageLimit);
    }

    [Fact]
    public void Should_Issue_As_Active_Unpublished_With_Normalised_Code()
    {
        var voucher = Issue();

        Assert.Equal(VoucherStatus.Active, voucher.Status);
        Assert.False(voucher.IsPublished);
        Assert.Equal("SUM26", voucher.Code);
        Assert.Equal(0, voucher.UsedCount);
    }

    [Fact]
    public void Should_Reject_Invalid_Definitions()
    {
        Assert.Throws<BusinessException>(() => Issue(DiscountType.None, 10m));
        Assert.Throws<BusinessException>(() => Issue(DiscountType.Percentage, 0m));
        Assert.Throws<BusinessException>(() => Issue(DiscountType.Percentage, 150m));
        Assert.Throws<BusinessException>(() => Issue(usageLimit: 0));
        Assert.Throws<BusinessException>(() => Voucher.Issue(
            Guid.NewGuid(), "X", "X", DiscountType.Money, 1m,
            new DateOnly(2026, 9, 1), new DateOnly(2026, 8, 1),
            VoucherScopeTarget.Service));
    }

    [Fact]
    public void Unpublished_Voucher_Should_Not_Be_Available()
    {
        var voucher = Issue();

        Assert.False(voucher.IsAvailableFor(_inWindow, 1_000_000m));
    }

    [Fact]
    public void Published_Voucher_Should_Respect_The_Validity_Window()
    {
        var voucher = Issue();
        voucher.Publish();

        Assert.True(voucher.IsAvailableFor(_inWindow, 1_000_000m));
        Assert.False(voucher.IsAvailableFor(new DateOnly(2026, 7, 31), 1_000_000m));
        Assert.False(voucher.IsAvailableFor(new DateOnly(2026, 9, 1), 1_000_000m));
    }

    [Fact]
    public void Should_Respect_The_Minimum_Order_Value()
    {
        var voucher = Issue(minOrderValue: 2_000_000m);
        voucher.Publish();

        Assert.False(voucher.IsAvailableFor(_inWindow, 1_000_000m));
        Assert.True(voucher.IsAvailableFor(_inWindow, 2_000_000m));
    }

    [Fact]
    public void Should_Cap_A_Percentage_Discount()
    {
        var voucher = Issue(DiscountType.Percentage, 20m, maxDiscountAmount: 1_000_000m);

        Assert.Equal(1_000_000m, voucher.CalculateDiscount(10_000_000m));
        Assert.Equal(400_000m, voucher.CalculateDiscount(2_000_000m));
    }

    [Fact]
    public void Should_Never_Discount_More_Than_The_Order()
    {
        var voucher = Issue(DiscountType.Money, 5_000_000m);

        Assert.Equal(1_000_000m, voucher.CalculateDiscount(1_000_000m));
    }

    [Fact]
    public void Redeem_Should_Consume_A_Use_And_Return_The_Discount()
    {
        var voucher = Issue(DiscountType.Money, 300_000m, usageLimit: 2);
        voucher.Publish();

        var discount = voucher.Redeem(_inWindow, 1_000_000m);

        Assert.Equal(300_000m, discount);
        Assert.Equal(1, voucher.UsedCount);
        Assert.Equal(1, voucher.RemainingUses);
        Assert.Equal(VoucherStatus.Active, voucher.Status);
    }

    [Fact]
    public void Should_Transition_To_OutOfUses_When_Limit_Reached()
    {
        var voucher = Issue(DiscountType.Money, 100_000m, usageLimit: 1);
        voucher.Publish();

        voucher.Redeem(_inWindow, 1_000_000m);

        Assert.True(voucher.IsExhausted);
        Assert.Equal(VoucherStatus.OutOfUses, voucher.Status);
        Assert.Throws<BusinessException>(() => voucher.Redeem(_inWindow, 1_000_000m));
    }

    [Fact]
    public void Should_Not_Redeem_An_Unpublished_Voucher()
    {
        var voucher = Issue();

        Assert.Throws<BusinessException>(() => voucher.Redeem(_inWindow, 1_000_000m));
    }

    [Fact]
    public void Should_Not_Publish_An_Expired_Voucher()
    {
        var voucher = Issue();
        voucher.Expire();

        Assert.Throws<BusinessException>(() => voucher.Publish());
    }

    [Fact]
    public void Publish_And_Unpublish_Should_Toggle_State()
    {
        var voucher = Issue();
        voucher.Publish();

        Assert.True(voucher.IsPublished);
        Assert.NotNull(voucher.PublishedAt);

        voucher.Unpublish();

        Assert.False(voucher.IsPublished);
        Assert.Null(voucher.PublishedAt);
    }

    [Fact]
    public void Reschedule_Should_Reactivate_Expired_Voucher_If_New_Dates_Are_Valid()
    {
        var voucher = Issue();
        voucher.Expire();

        voucher.Reschedule(DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)));

        Assert.Equal(VoucherStatus.Active, voucher.Status);
    }

    [Fact]
    public void UpdateUsageLimit_Should_Reactivate_OutOfUses_Voucher()
    {
        var voucher = Issue(DiscountType.Money, 100_000m, usageLimit: 1);
        voucher.Publish();
        voucher.Redeem(_inWindow, 1_000_000m);

        Assert.Equal(VoucherStatus.OutOfUses, voucher.Status);

        voucher.UpdateUsageLimit(5);

        Assert.Equal(VoucherStatus.Active, voucher.Status);
        Assert.Equal(5, voucher.UsageLimit);
    }

    [Fact]
    public void Unlimited_Voucher_Should_Never_Be_Exhausted()
    {
        var voucher = Issue(DiscountType.Money, 50_000m);
        voucher.Publish();

        voucher.Redeem(_inWindow, 500_000m);
        voucher.Redeem(_inWindow, 500_000m);

        Assert.False(voucher.IsExhausted);
        Assert.Null(voucher.RemainingUses);
        Assert.Equal(2, voucher.UsedCount);
    }

    [Fact]
    public void ChangeCode_Should_Normalise_The_New_Code()
    {
        var voucher = Issue();

        voucher.ChangeCode("  new-code26 ");

        Assert.Equal("NEW-CODE26", voucher.Code);
    }

    [Fact]
    public void ChangeDiscount_Should_Replace_Type_And_Value()
    {
        var voucher = Issue(DiscountType.Percentage, 10m);

        voucher.ChangeDiscount(DiscountType.Money, 250_000m);

        Assert.Equal(DiscountType.Money, voucher.DiscountType);
        Assert.Equal(250_000m, voucher.DiscountValue);
    }

    [Theory]
    [InlineData(DiscountType.None, 10)]
    [InlineData(DiscountType.Percentage, 0)]
    [InlineData(DiscountType.Percentage, 101)]
    [InlineData(DiscountType.Money, -1)]
    public void ChangeDiscount_Should_Reject_Invalid_Discounts(DiscountType type, decimal value)
    {
        var voucher = Issue();

        Assert.Throws<BusinessException>(() => voucher.ChangeDiscount(type, value));
    }

    [Fact]
    public void Should_Store_Scope_And_Exclusivity()
    {
        var voucher = Voucher.Issue(
            Guid.NewGuid(), "SVC01", "Theo dịch vụ", DiscountType.Percentage, 10m,
            _from, _to, VoucherScopeTarget.Service,
            isExclusive: true,
            targetIds: [Guid.NewGuid()]);

        Assert.Equal(VoucherScopeTarget.Service, voucher.ScopeTarget);
        Assert.True(voucher.IsExclusive);
        Assert.Single(voucher.TargetIds);
    }
}
