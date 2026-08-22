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
        decimal? minOrderAmount = null,
        VoucherCustomerTarget target = VoucherCustomerTarget.All,
        int? usageLimit = null)
    {
        return Voucher.Issue(
            Guid.NewGuid(), "sum26", "Khuyến mãi hè", discountType, discountValue,
            _from, _to,
            maxDiscountAmount: maxDiscountAmount,
            minOrderAmount: minOrderAmount,
            customerTarget: target,
            usageLimit: usageLimit);
    }

    [Fact]
    public void Should_Issue_As_Draft_With_Normalised_Code()
    {
        var voucher = Issue();

        Assert.Equal(VoucherStatus.Draft, voucher.Status);
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
            new DateOnly(2026, 9, 1), new DateOnly(2026, 8, 1)));
    }

    [Fact]
    public void Draft_Voucher_Should_Not_Be_Available()
    {
        var voucher = Issue();

        Assert.False(voucher.IsAvailableFor(_inWindow, 1_000_000m, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Should_Respect_The_Validity_Window()
    {
        var voucher = Issue();
        voucher.Activate();

        Assert.True(voucher.IsAvailableFor(_inWindow, 1_000_000m, VoucherCustomerTarget.All));
        Assert.False(voucher.IsAvailableFor(new DateOnly(2026, 7, 31), 1_000_000m, VoucherCustomerTarget.All));
        Assert.False(voucher.IsAvailableFor(new DateOnly(2026, 9, 1), 1_000_000m, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Should_Respect_The_Minimum_Order_Amount()
    {
        var voucher = Issue(minOrderAmount: 2_000_000m);
        voucher.Activate();

        Assert.False(voucher.IsAvailableFor(_inWindow, 1_000_000m, VoucherCustomerTarget.All));
        Assert.True(voucher.IsAvailableFor(_inWindow, 2_000_000m, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Should_Respect_The_Customer_Target()
    {
        var voucher = Issue(target: VoucherCustomerTarget.Returning);
        voucher.Activate();

        Assert.True(voucher.IsAvailableFor(_inWindow, 1_000_000m, VoucherCustomerTarget.Returning));
        Assert.False(voucher.IsAvailableFor(_inWindow, 1_000_000m, VoucherCustomerTarget.New));
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
        voucher.Activate();

        var discount = voucher.Redeem(_inWindow, 1_000_000m, VoucherCustomerTarget.All);

        Assert.Equal(300_000m, discount);
        Assert.Equal(1, voucher.UsedCount);
        Assert.Equal(1, voucher.RemainingUses);
        Assert.Equal(VoucherStatus.Active, voucher.Status);
    }

    [Fact]
    public void Should_Expire_When_The_Usage_Limit_Is_Reached()
    {
        var voucher = Issue(DiscountType.Money, 100_000m, usageLimit: 1);
        voucher.Activate();

        voucher.Redeem(_inWindow, 1_000_000m, VoucherCustomerTarget.All);

        Assert.True(voucher.IsExhausted);
        Assert.Equal(VoucherStatus.Expired, voucher.Status);
        Assert.Throws<BusinessException>(() =>
            voucher.Redeem(_inWindow, 1_000_000m, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Should_Not_Redeem_A_Paused_Voucher()
    {
        var voucher = Issue();
        voucher.Activate();
        voucher.Pause();

        Assert.Throws<BusinessException>(() =>
            voucher.Redeem(_inWindow, 1_000_000m, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Should_Not_Activate_An_Expired_Voucher()
    {
        var voucher = Issue();
        voucher.Expire();

        Assert.Throws<BusinessException>(() => voucher.Activate());
    }

    [Fact]
    public void Should_Lock_Details_After_First_Redemption()
    {
        var voucher = Issue(DiscountType.Money, 100_000m);
        voucher.Activate();
        voucher.Redeem(_inWindow, 1_000_000m, VoucherCustomerTarget.All);

        Assert.Throws<BusinessException>(() => voucher.UpdateDetails(
            "Đổi tên", null, null, null, VoucherCustomerTarget.All));
    }

    [Fact]
    public void Unlimited_Voucher_Should_Never_Be_Exhausted()
    {
        var voucher = Issue(DiscountType.Money, 50_000m);
        voucher.Activate();

        voucher.Redeem(_inWindow, 500_000m, VoucherCustomerTarget.All);
        voucher.Redeem(_inWindow, 500_000m, VoucherCustomerTarget.All);

        Assert.False(voucher.IsExhausted);
        Assert.Null(voucher.RemainingUses);
        Assert.Equal(2, voucher.UsedCount);
    }
}
