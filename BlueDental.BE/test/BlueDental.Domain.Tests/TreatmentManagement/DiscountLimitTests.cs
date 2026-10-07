using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Cụm 11 mục 12 — Quy định giảm giá: the most one account may take off a line
/// or a slip, as a share of the price and as an amount.
/// </summary>
public class DiscountLimitTests
{
    [Fact]
    public void No_Limit_Allows_Anything()
    {
        Should.NotThrow(() => new DiscountLimit(null, null).EnsureAllows(1_000_000m, 1_000_000m));
    }

    [Theory]
    [InlineData(100_000, true)]
    [InlineData(100_100, false)]
    public void The_Percent_Is_Of_The_Price_The_Line_Would_Sell_At(decimal discount, bool allowed)
    {
        var limit = new DiscountLimit(10m, null);

        var act = () => limit.EnsureAllows(1_000_000m, discount);

        if (allowed) act.ShouldNotThrow();
        else act.ShouldThrow<BusinessException>().Code
            .ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.DiscountAbovePercent);
    }

    [Fact]
    public void The_Amount_Caps_Even_A_Small_Share_Of_A_Big_Price()
    {
        var limit = new DiscountLimit(10m, 500_000m);

        Should.NotThrow(() => limit.EnsureAllows(50_000_000m, 500_000m));
        var ex = Should.Throw<BusinessException>(() => limit.EnsureAllows(50_000_000m, 600_000m));
        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.DiscountAboveUserAmount);
        ex.Data["MaxAmount"].ShouldBe("500.000");
    }

    [Fact]
    public void Keeping_Or_Lowering_A_Discount_Someone_Else_Gave_Is_Always_Allowed()
    {
        var limit = new DiscountLimit(5m, 100_000m);

        var managers = new DiscountLimit.Measure(1_000_000m, 300_000m);

        Should.NotThrow(() => limit.EnsureAllows(1_000_000m, 300_000m, managers));
        Should.NotThrow(() => limit.EnsureAllows(1_000_000m, 200_000m, managers));
        Should.Throw<BusinessException>(() => limit.EnsureAllows(1_000_000m, 300_001m, managers));
    }

    [Fact]
    public void The_Same_Discount_Over_Less_Is_A_Bigger_Share_And_Is_Checked()
    {
        var limit = new DiscountLimit(10m, null);
        var tenUnits = new DiscountLimit.Measure(10_000_000m, 1_000_000m);

        // 10 units, 1.000.000 off: 10 %. The same 1.000.000 off one unit is 100 %.
        Should.NotThrow(() => limit.EnsureAllows(10_000_000m, 1_000_000m));
        Should.Throw<BusinessException>(() => limit.EnsureAllows(1_000_000m, 1_000_000m, tenUnits))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.DiscountAbovePercent);
    }

    [Fact]
    public void A_Discount_On_A_Line_Worth_Nothing_Is_All_Of_It()
    {
        Should.Throw<BusinessException>(() => new DiscountLimit(50m, null).EnsureAllows(0m, 10m));
    }

    [Theory]
    [InlineData(-1.0, null)]
    [InlineData(100.5, null)]
    [InlineData(null, -1.0)]
    public void A_Limit_Out_Of_Range_Is_Refused(double? percent, double? amount)
    {
        Should.Throw<BusinessException>(() => DiscountLimit.EnsureValid((decimal?)percent, (decimal?)amount))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Staff.InvalidDiscountLimit);
    }
}
