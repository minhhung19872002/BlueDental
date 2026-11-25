using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// "Chỉnh sửa" on the plan table — what staging's column builder allows a saved
/// line to change (measured 2026-09-24).
/// </summary>
public class TreatmentServiceReviseTests
{
    private static List<ToothSelection> Teeth(params int[] codes) =>
        codes.Select(code => new ToothSelection(code, selected: true)).ToList();

    private static TreatmentService Line(TreatmentServiceStatus status = TreatmentServiceStatus.Created)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 2, DiscountType.None, 0m, Teeth(11, 21));
        if (status != TreatmentServiceStatus.Created)
        {
            line.SetInitialStatus(status);
        }

        return line;
    }

    [Fact]
    public void A_fresh_line_takes_new_price_teeth_and_diagnosis()
    {
        var line = Line();
        var diagnosis = Guid.NewGuid();

        line.Revise(900_000m, 3, Teeth(11, 21, 22), diagnosis, 0m);

        line.Price.ShouldBe(900_000m);
        line.Quantity.ShouldBe(3);
        line.DiagnosisId.ShouldBe(diagnosis);
        line.Teeth.Select(t => t.ToothCode).ShouldBe([11, 21, 22]);
    }

    [Theory]
    [InlineData(TreatmentServiceStatus.Done)]
    [InlineData(TreatmentServiceStatus.Cancelled)]
    [InlineData(TreatmentServiceStatus.Replaced)]
    public void A_closed_line_cannot_be_edited(TreatmentServiceStatus status)
    {
        Should.Throw<BusinessException>(() =>
                Line(status).Revise(1_000_000m, 2, Teeth(11, 21), null, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineNotEditable);
    }

    // R-1314 (BA 2026-11-25): a line paid on is edited too, but what it
    // charges stays — teeth and nothing that moves the money.
    [Theory]
    [InlineData(TreatmentServiceStatus.Created)]
    [InlineData(TreatmentServiceStatus.InProgress)]
    public void A_line_paid_on_changes_its_teeth_and_keeps_its_charge(TreatmentServiceStatus status)
    {
        var line = Line(status);

        line.Revise(1_000_000m, 2, Teeth(11, 12, 13), null, 500_000m, (DiscountType.None, 0m));

        line.Teeth.Select(t => t.ToothCode).ShouldBe([11, 12, 13]);
        line.Quantity.ShouldBe(2);
        line.EffectiveAmount.ShouldBe(2_000_000m);
    }

    [Fact]
    public void A_line_paid_on_keeps_its_quantity_price_discount_and_diagnosis()
    {
        var line = Line();
        const string locked = BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLinePaidPricingLocked;

        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 3, Teeth(11, 21), null, 500_000m)).Code.ShouldBe(locked);
        Should.Throw<BusinessException>(() =>
                line.Revise(900_000m, 2, Teeth(11, 21), null, 500_000m)).Code.ShouldBe(locked);
        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 2, Teeth(11, 21), null, 500_000m, (DiscountType.Percentage, 5m)))
            .Code.ShouldBe(locked);
        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 2, Teeth(11, 21), Guid.NewGuid(), 500_000m)).Code.ShouldBe(locked);

        line.Quantity.ShouldBe(2);
        line.Price.ShouldBe(1_000_000m);
    }

    [Fact]
    public void A_line_in_treatment_keeps_its_price_and_diagnosis()
    {
        var line = Line(TreatmentServiceStatus.InProgress);

        Should.Throw<BusinessException>(() =>
                line.Revise(800_000m, 2, Teeth(11, 21), null, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineLockedInTreatment);
        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 2, Teeth(11, 21), Guid.NewGuid(), 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineLockedInTreatment);

        // Everything else still moves.
        line.Revise(1_000_000m, 3, Teeth(11, 21, 22), null, 0m);
        line.Quantity.ShouldBe(3);
    }

    // The "Chỉnh sửa" modal (owner 2026-10-15) also rewrites the line's discount.

    [Fact]
    public void A_fresh_line_takes_a_new_discount()
    {
        var line = Line();

        line.Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, (DiscountType.Percentage, 10m));

        line.DiscountType.ShouldBe(DiscountType.Percentage);
        line.DiscountValue.ShouldBe(10m);
        line.EffectiveAmount.ShouldBe(1_800_000m);

        line.Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, (DiscountType.None, 0m));
        line.EffectiveAmount.ShouldBe(2_000_000m);
    }

    [Fact]
    public void Without_a_discount_the_line_keeps_its_own()
    {
        var line = Line();
        line.Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, (DiscountType.Money, 300_000m));

        line.Revise(1_000_000m, 3, Teeth(11, 21), null, 0m);

        line.DiscountType.ShouldBe(DiscountType.Money);
        line.DiscountValue.ShouldBe(300_000m);
    }

    [Theory]
    [InlineData(DiscountType.Percentage, 101)]
    [InlineData(DiscountType.Money, 2_000_001)]
    [InlineData(DiscountType.Money, -1)]
    [InlineData(DiscountType.None, 5)]
    public void An_invalid_discount_is_refused(DiscountType type, int value)
    {
        Should.Throw<BusinessException>(() =>
                Line().Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, (type, value)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount);
    }

    [Fact]
    public void A_line_in_treatment_keeps_its_discount()
    {
        var line = Line(TreatmentServiceStatus.InProgress);

        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, (DiscountType.Percentage, 5m)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineLockedInTreatment);

        // Sending the discount it already has is not a change.
        line.Revise(1_000_000m, 3, Teeth(11, 21), null, 0m, (DiscountType.None, 0m));
        line.Quantity.ShouldBe(3);
    }

    // R-1314: a line in treatment may drop or swap any tooth, a staged one too
    // (the reference's "Răng … đang điều trị — không thể bỏ chọn" is gone).
    [Fact]
    public void A_line_in_treatment_changes_its_teeth()
    {
        var line = Line(TreatmentServiceStatus.InProgress);

        line.Revise(1_000_000m, 2, Teeth(21, 22), null, 0m);

        line.Teeth.Select(t => t.ToothCode).ShouldBe([21, 22]);
        line.Price.ShouldBe(1_000_000m);
    }

    // Staging 2026-09-28: a 1.000.000 line edited to 910.000 reads Đơn giá
    // 1.000.000, "Giảm dịch vụ: 90.000 đ" (serviceDiscount), and its giá gốc
    // is the ceiling — "Đơn giá không được lớn hơn giá gốc của dịch vụ."

    [Fact]
    public void Lowering_the_unit_price_is_the_lines_own_discount()
    {
        var line = Line();

        line.Revise(910_000m, 2, Teeth(11, 21), null, 0m);

        line.OriginalPrice.ShouldBe(1_000_000m);
        line.ListAmount.ShouldBe(2_000_000m);
        line.ServiceDiscountAmount.ShouldBe(180_000m);
        line.EffectiveAmount.ShouldBe(1_820_000m);
        (line.ListAmount - line.ServiceDiscountAmount).ShouldBe(line.EffectiveAmount);
    }

    [Fact]
    public void The_unit_price_never_rises_above_the_original()
    {
        var line = Line();
        line.Revise(910_000m, 2, Teeth(11, 21), null, 0m);

        Should.Throw<BusinessException>(() =>
                line.Revise(1_100_000m, 2, Teeth(11, 21), null, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.UnitPriceAboveOriginal);

        // Back up to the giá gốc is fine — the discount goes away.
        line.Revise(1_000_000m, 2, Teeth(11, 21), null, 0m);
        line.ServiceDiscountAmount.ShouldBe(0m);
    }

    [Fact]
    public void A_new_line_cannot_open_above_its_original_price()
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");

        Should.Throw<BusinessException>(() => plan.AddService(
                Guid.NewGuid(), Guid.NewGuid(), null, 1_100_000m, 1, DiscountType.None, 0m,
                originalPrice: 1_000_000m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.UnitPriceAboveOriginal);

        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 910_000m, 1, DiscountType.None, 0m,
            originalPrice: 1_000_000m);
        line.OriginalPrice.ShouldBe(1_000_000m);
        line.ServiceDiscountAmount.ShouldBe(90_000m);
    }

    [Fact]
    public void Without_a_known_original_the_line_opens_at_its_own_price()
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");

        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 750_000m, 1, DiscountType.None, 0m, originalPrice: 0m);

        line.OriginalPrice.ShouldBe(750_000m);
        line.ServiceDiscountAmount.ShouldBe(0m);
    }

    [Fact]
    public void The_tooltips_four_parts_add_up_to_the_total_discount()
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 1, DiscountType.None, 0m,
            originalPrice: 1_000_000m);
        plan.ApplyVoucher(100_000m);
        line.Revise(910_000m, 1, [], null, 0m);

        var parts = plan.DiscountShareParts()[line.Id];

        line.ServiceDiscountAmount.ShouldBe(90_000m);
        parts.Own.ShouldBe(0m);
        parts.Voucher.ShouldBe(100_000m);
        plan.ServicesGrossTotal.ShouldBe(1_000_000m);
        plan.TotalDiscountAmount.ShouldBe(190_000m);
        plan.TotalAmount.ShouldBe(810_000m);
        plan.ChargedAmountOf(line).ShouldBe(810_000m);
    }

    [Fact]
    public void Slip_discount_and_voucher_split_across_lines_without_moving_the_charge()
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var lines = new[] { 300_000m, 300_000m, 400_000m }
            .Select(price => plan.AddService(
                Guid.NewGuid(), Guid.NewGuid(), null, price, 1, DiscountType.None, 0m))
            .ToList();
        plan.ApplyDiscount(DiscountType.Money, 100_000m);
        plan.ApplyVoucher(50_000m);

        var shares = plan.DiscountShares();
        var parts = plan.DiscountShareParts();

        parts.Values.Sum(p => p.Voucher).ShouldBe(50_000m);
        parts.Values.Sum(p => p.Own).ShouldBe(100_000m);
        foreach (var line in lines)
        {
            (parts[line.Id].Own + parts[line.Id].Voucher).ShouldBe(shares[line.Id]);
        }
    }
}
