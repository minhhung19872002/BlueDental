using System;
using BlueDental.Catalogs;
using BlueDental.EInvoicing;
using BlueDental.TreatmentManagement;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// Bug list item 15 (2026-10-06): a service priced 1.000.000, −10 %, 8 % VAT
/// shows "Thực thu gồm VAT 972.000" in Danh mục, but the slip, the receipt and
/// the e-invoice all asked for 900.000. VAT is now stamped on each line and
/// charged on what the line costs once every discount is off.
/// </summary>
public class TreatmentPlanVatTests
{
    private static TreatmentPlan Open(DiscountType planDiscount = DiscountType.None, decimal planDiscountValue = 0m) =>
        TreatmentPlan.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT04", "Kế hoạch điều trị",
            discountType: planDiscount, discountValue: planDiscountValue);

    [Fact]
    public void The_Bug_List_Example_Asks_For_972_000()
    {
        var plan = Open();
        // Giá 1.000.000 lowered by the catalog's 10 % to 900.000, as the picker offers it.
        var line = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, 900_000m, 1, DiscountType.None, 0m,
            originalPrice: 1_000_000m).StampTaxRate(ServiceTaxRate.Eight);

        plan.ChargedAmountOf(line).ShouldBe(900_000m);
        plan.TaxAmountOf(line).ShouldBe(72_000m);
        plan.PayableAmountOf(line).ShouldBe(972_000m);
        plan.TotalAmount.ShouldBe(900_000m);
        plan.TaxAmount.ShouldBe(72_000m);
        plan.PayableAmount.ShouldBe(972_000m);
    }

    [Fact]
    public void VAT_Is_Charged_After_The_Slip_Discount_Share()
    {
        var plan = Open(DiscountType.Money, 100_000m);
        var taxed = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 1, DiscountType.None, 0m)
            .StampTaxRate(ServiceTaxRate.Ten);
        var exempt = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 1, DiscountType.None, 0m)
            .StampTaxRate(ServiceTaxRate.NotTaxable);

        // 100.000 off the slip splits 50.000 / 50.000.
        plan.ChargedAmountOf(taxed).ShouldBe(950_000m);
        plan.TaxAmountOf(taxed).ShouldBe(95_000m);
        plan.TaxAmountOf(exempt).ShouldBe(0m);
        plan.PayableAmount.ShouldBe(1_900_000m + 95_000m);
    }

    [Fact]
    public void A_Line_Older_Than_VAT_On_Slips_Charges_None()
    {
        var plan = Open();
        var line = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, 500_000m, 1, DiscountType.None, 0m);

        line.TaxRate.ShouldBeNull();
        plan.TaxAmountOf(line).ShouldBe(0m);
        plan.PayableAmount.ShouldBe(plan.TotalAmount);
    }

    [Fact]
    public void A_Cancelled_Line_Charges_No_VAT()
    {
        var plan = Open();
        var line = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), null, 500_000m, 1, DiscountType.None, 0m)
            .StampTaxRate(ServiceTaxRate.Eight);
        line.Cancel();

        plan.TaxAmountOf(line).ShouldBe(0m);
        plan.TaxAmount.ShouldBe(0m);
    }

    [Theory]
    [InlineData(972_000, 8, 900_000, 72_000)]
    [InlineData(1_100_000, 10, 1_000_000, 100_000)]
    [InlineData(500_000, -1, 500_000, 0)]
    [InlineData(333_333, 8, 308_642, 24_691)]
    public void An_Invoice_Line_Backs_VAT_Out_Of_What_Was_Paid(decimal paid, int rate, decimal total, decimal tax)
    {
        var line = ElectronicInvoiceDraft.LineFromGross("DV01", "Tẩy trắng", "Lần", 1m, paid, rate);

        line.Total.ShouldBe(total);
        line.TaxAmount.ShouldBe(tax);
        line.Amount.ShouldBe(paid);
    }

    [Theory]
    [InlineData(ServiceTaxRate.NotTaxable, -1)]
    [InlineData(ServiceTaxRate.NotDeclared, -1)]
    [InlineData(ServiceTaxRate.Zero, 0)]
    [InlineData(ServiceTaxRate.Five, 5)]
    [InlineData(ServiceTaxRate.Eight, 8)]
    [InlineData(ServiceTaxRate.Ten, 10)]
    public void A_Service_Rate_Maps_To_The_Provider_Rate(ServiceTaxRate rate, int expected)
    {
        ElectronicInvoiceDraft.VatRateOf(rate).ShouldBe(expected);
    }
}
