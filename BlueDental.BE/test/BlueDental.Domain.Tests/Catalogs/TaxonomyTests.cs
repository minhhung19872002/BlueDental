using System;
using BlueDental.Catalogs;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Catalogs;

public class TaxonomyTests
{
    private readonly Guid _branchId = Guid.NewGuid();

    private Taxonomy Create(string group = TaxonomyGroups.CareService, string? color = null, bool isSystem = false) =>
        Taxonomy.Create(Guid.NewGuid(), _branchId, group, "NHA KHOA TỔNG QUÁT", color: color, isSystem: isSystem);

    [Fact]
    public void Should_Reject_A_Group_The_Reference_Does_Not_Have()
    {
        Assert.Throws<BusinessException>(() => Create("made_up_group"));
    }

    [Theory]
    [InlineData(TaxonomyGroups.CareService, true)]
    [InlineData(TaxonomyGroups.MedicationType, true)]
    [InlineData(TaxonomyGroups.Supplies, true)]
    [InlineData(TaxonomyGroups.Diagnosis, false)]
    [InlineData(TaxonomyGroups.Occupation, false)]
    public void Should_Know_Which_Groups_Are_Priced(string group, bool expected)
    {
        Assert.Equal(expected, Create(group).IsPriced);
    }

    [Theory]
    [InlineData(TaxonomyGroups.PrescriptionTemplate, true)]
    [InlineData(TaxonomyGroups.MedicalRecordTemplate, true)]
    [InlineData(TaxonomyGroups.CareService, false)]
    public void Should_Know_Which_Groups_Carry_Templates(string group, bool expected)
    {
        Assert.Equal(expected, Create(group).IsTemplated);
    }

    [Theory]
    [InlineData("#F59E0B")]
    [InlineData("#fff")]
    public void Should_Accept_Hex_Colors(string color)
    {
        Assert.Equal(color, Create(color: color).Color);
    }

    [Theory]
    [InlineData("orange")]
    [InlineData("F59E0B")]
    [InlineData("#12345")]
    public void Should_Reject_Non_Hex_Colors(string color)
    {
        Assert.Throws<BusinessException>(() => Create(color: color));
    }

    [Fact]
    public void Should_Not_Rename_A_System_Group()
    {
        var taxonomy = Create(isSystem: true);

        Assert.Throws<BusinessException>(() => taxonomy.Rename("Khác"));
    }
}

public class CatalogEntryTests
{
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _taxonomyId = Guid.NewGuid();

    private CatalogEntry Create(
        string group = TaxonomyGroups.CareService,
        decimal? price = null,
        string? content = null) =>
        CatalogEntry.Create(
            Guid.NewGuid(), _branchId, _taxonomyId, group, "Cạo vôi, đánh bóng",
            code: "DT02", price: price, content: content);

    [Fact]
    public void Should_Create_An_Active_Entry()
    {
        var entry = Create(price: 180_000m);

        Assert.True(entry.IsActive);
        Assert.Equal(180_000m, entry.Price);
        Assert.Equal("DT02", entry.Code);
    }

    [Fact]
    public void Should_Reject_A_Price_On_An_Unpriced_Catalog()
    {
        Assert.Throws<BusinessException>(() => Create(TaxonomyGroups.Diagnosis, price: 1_000m));
    }

    [Fact]
    public void Should_Reject_A_Negative_Price()
    {
        Assert.Throws<BusinessException>(() => Create(price: -1m));
    }

    [Fact]
    public void Should_Reject_Content_On_A_Non_Template_Catalog()
    {
        Assert.Throws<BusinessException>(() => Create(content: "<p>x</p>"));
    }

    [Fact]
    public void Should_Accept_Content_On_A_Template_Catalog()
    {
        var entry = Create(TaxonomyGroups.PrescriptionTemplate, content: "Amoxicillin 500mg");

        Assert.Equal("Amoxicillin 500mg", entry.Content);
        Assert.Null(entry.Price);
    }

    [Fact]
    public void Should_Allow_Clearing_A_Price()
    {
        var entry = Create(price: 180_000m);

        entry.ChangePrice(null);

        Assert.Null(entry.Price);
    }

    [Fact]
    public void Should_Toggle_Image_Requirement_On_The_Service_Configuration()
    {
        // The flag moved off the shared entry onto the service's own settings,
        // which is where the reference keeps it.
        var entry = Create(price: 1_000m);
        var config = entry.EnsureServiceConfig(Guid.NewGuid());

        config.Update(ServiceTaxRate.NotTaxable, false, true, 0m,
            requireImage: true, false, false, false, false, false, 0);
        Assert.True(entry.ServiceConfig!.RequireImage);

        config.Update(ServiceTaxRate.NotTaxable, false, true, 0m,
            requireImage: false, false, false, false, false, false, 0);
        Assert.False(entry.ServiceConfig!.RequireImage);
    }

    [Theory]
    // Trước thuế: the discount comes off, then VAT goes on.
    [InlineData(true, false, 10, ServiceTaxRate.Ten, 900, 990)]
    // Sau thuế: the price already carries VAT, so nothing is added.
    [InlineData(true, true, 10, ServiceTaxRate.Ten, 900, 900)]
    // A flat discount in đồng rather than a percentage.
    [InlineData(false, false, 250, ServiceTaxRate.NotTaxable, 750, 750)]
    // A discount larger than the price cannot make the customer owe less than nothing.
    [InlineData(false, false, 5_000, ServiceTaxRate.Ten, 0, 0)]
    public void Should_Price_A_Service(
        bool discountIsPercent,
        bool priceIncludesTax,
        int discountValue,
        ServiceTaxRate taxRate,
        int expectedAfterDiscount,
        int expectedCollected)
    {
        var entry = Create(price: 1_000m);
        var config = entry.EnsureServiceConfig(Guid.NewGuid());
        config.Update(taxRate, priceIncludesTax, discountIsPercent, discountValue,
            false, false, false, false, false, false, 0);

        Assert.Equal(expectedAfterDiscount, config.PriceAfterDiscount(1_000m));
        Assert.Equal(expectedCollected, config.AmountCollected(1_000m));
    }

    [Fact]
    public void Should_Refuse_A_Percentage_Discount_Over_One_Hundred()
    {
        var config = Create(price: 1_000m).EnsureServiceConfig(Guid.NewGuid());

        Assert.Throws<BusinessException>(() => config.Update(
            ServiceTaxRate.NotTaxable, false, true, 101m,
            false, false, false, false, false, false, 0));
    }

    [Fact]
    public void Should_Compute_The_Quantity_Of_A_Prescription_Line()
    {
        var line = new PrescriptionTemplateLine(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            timesPerDay: 2, amountPerTime: 1.5m, days: 5,
            PrescriptionUsage.AfterMeal | PrescriptionUsage.BeforeSleep, sortOrder: 0);

        Assert.Equal(15m, line.Quantity);
        Assert.True(line.Usage.HasFlag(PrescriptionUsage.BeforeSleep));
    }

    [Fact]
    public void Should_Refuse_An_Empty_Prescription_Line()
    {
        Assert.Throws<BusinessException>(() => new PrescriptionTemplateLine(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            timesPerDay: 0, amountPerTime: 1m, days: 1, PrescriptionUsage.None, 0));
    }

    [Fact]
    public void Should_Deactivate_And_Reactivate()
    {
        var entry = Create(price: 1_000m);

        entry.Deactivate();
        Assert.False(entry.IsActive);

        entry.Activate();
        Assert.True(entry.IsActive);
    }
}
