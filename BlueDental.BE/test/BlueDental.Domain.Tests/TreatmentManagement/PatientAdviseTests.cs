using System;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class PatientAdviseTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _patientDiagnosisId = Guid.NewGuid();
    private readonly Guid _diagnosisId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private PatientAdvise CreateAdvise(
        decimal price = 1_000_000m,
        int quantity = 1,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m)
    {
        return PatientAdvise.Offer(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _patientDiagnosisId,
            _diagnosisId,
            _serviceId,
            _staffId,
            "TV26-0001",
            originalPrice: 1_200_000m,
            price: price,
            quantity: quantity,
            teeth: new[] { new ToothSelection(36, selected: true) },
            discountType: discountType,
            discountValue: discountValue);
    }

    [Fact]
    public void Should_Offer_Advise_As_Created()
    {
        var advise = CreateAdvise();

        Assert.Equal(PatientAdviseStatus.Created, advise.Status);
        Assert.Null(advise.TreatmentPlanId);
        Assert.Equal(1_000_000m, advise.EffectiveAmount);
    }

    [Fact]
    public void Should_Reject_Non_Positive_Quantity()
    {
        Assert.Throws<BusinessException>(() => CreateAdvise(quantity: 0));
    }

    [Fact]
    public void Should_Compute_Gross_Amount_From_Price_And_Quantity()
    {
        var advise = CreateAdvise(price: 500_000m, quantity: 3);

        Assert.Equal(1_500_000m, advise.GrossAmount);
        Assert.Equal(1_500_000m, advise.EffectiveAmount);
    }

    [Fact]
    public void Should_Apply_Percentage_Discount()
    {
        var advise = CreateAdvise(price: 1_000_000m, quantity: 2,
            discountType: DiscountType.Percentage, discountValue: 10m);

        Assert.Equal(200_000m, advise.DiscountAmount);
        Assert.Equal(1_800_000m, advise.EffectiveAmount);
    }

    [Fact]
    public void Should_Apply_Money_Discount()
    {
        var advise = CreateAdvise(discountType: DiscountType.Money, discountValue: 300_000m);

        Assert.Equal(300_000m, advise.DiscountAmount);
        Assert.Equal(700_000m, advise.EffectiveAmount);
    }

    [Fact]
    public void Should_Reject_Percentage_Discount_Above_100()
    {
        Assert.Throws<BusinessException>(() =>
            CreateAdvise(discountType: DiscountType.Percentage, discountValue: 120m));
    }

    [Fact]
    public void Should_Reject_Money_Discount_Above_Line_Total()
    {
        Assert.Throws<BusinessException>(() =>
            CreateAdvise(price: 100_000m, discountType: DiscountType.Money, discountValue: 200_000m));
    }

    [Fact]
    public void Should_Never_Discount_Below_Zero()
    {
        var advise = CreateAdvise(price: 1_000_000m,
            discountType: DiscountType.Money, discountValue: 900_000m);

        advise.ApplyVoucher(500_000m);

        Assert.Equal(1_000_000m, advise.DiscountAmount);
        Assert.Equal(0m, advise.EffectiveAmount);
    }

    [Fact]
    public void Should_Convert_Into_Treatment_Plan_Once()
    {
        var advise = CreateAdvise();
        var planId = Guid.NewGuid();

        advise.Accept();
        advise.ConvertTo(planId);

        Assert.Equal(PatientAdviseStatus.Converted, advise.Status);
        Assert.Equal(planId, advise.TreatmentPlanId);
        Assert.Throws<BusinessException>(() => advise.ConvertTo(Guid.NewGuid()));
    }

    [Fact]
    public void Should_Not_Convert_A_Rejected_Advise()
    {
        var advise = CreateAdvise();
        advise.Reject();

        Assert.Throws<BusinessException>(() => advise.ConvertTo(Guid.NewGuid()));
    }

    [Fact]
    public void Should_Not_Edit_A_Converted_Advise()
    {
        var advise = CreateAdvise();
        advise.ConvertTo(Guid.NewGuid());

        Assert.Throws<BusinessException>(() => advise.ChangePricing(1m, 1));
        Assert.Throws<BusinessException>(() => advise.ApplyDiscount(DiscountType.Money, 1m));
        Assert.Throws<BusinessException>(() => advise.MoveToGroup(Guid.NewGuid()));
    }

    [Fact]
    public void Should_Not_Cancel_A_Converted_Advise()
    {
        var advise = CreateAdvise();
        advise.ConvertTo(Guid.NewGuid());

        Assert.Throws<BusinessException>(() => advise.Cancel());
    }

    [Fact]
    public void Should_Not_Attach_The_Same_Image_Twice()
    {
        var advise = CreateAdvise();
        var imageId = Guid.NewGuid();

        advise.AttachImage(imageId);
        advise.AttachImage(imageId);

        Assert.Single(advise.ImageIds);

        advise.DetachImage(imageId);
        Assert.Empty(advise.ImageIds);
    }
}
