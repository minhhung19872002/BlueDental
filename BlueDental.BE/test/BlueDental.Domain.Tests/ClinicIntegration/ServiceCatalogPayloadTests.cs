using System;
using System.Linq;
using BlueDental.Catalogs;
using Xunit;

namespace BlueDental.ClinicIntegration;

public class ServiceCatalogPayloadTests
{
    private static readonly Guid Id = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static CatalogEntry Service(decimal? price = 500_000m, string? code = "HxHQ4") =>
        CatalogEntry.Create(Id, Guid.NewGuid(), Guid.NewGuid(), TaxonomyGroups.CareService, "Trám răng", code, price);

    [Fact]
    public void Carries_Our_Id_As_The_External_Id_And_The_Group_Name()
    {
        var item = ServiceCatalogPayload.From(Service(), "Nha khoa tổng quát");

        Assert.Equal(Id.ToString(), item.ExternalId);
        Assert.Equal("HxHQ4", item.Code);
        Assert.Equal("Nha khoa tổng quát", item.GroupName);
        Assert.Equal(500_000m, item.Price);
        Assert.Equal(nameof(ServiceTaxRate.NotTaxable), item.TaxRate);
    }

    [Fact]
    public void A_Service_Without_A_Code_Cannot_Be_Turned_Into_A_Payload()
    {
        Assert.Throws<InvalidOperationException>(() => ServiceCatalogPayload.From(Service(code: null), null));
    }

    [Fact]
    public void The_Same_Service_Always_Gives_The_Same_Fingerprint()
    {
        var first = ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(Service(1000m), "G"));
        var second = ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(Service(1000.00m), "G"));

        Assert.Equal(first, second);
        Assert.Equal(64, first.Length);
    }

    [Fact]
    public void A_New_Price_Or_Group_Name_Changes_The_Fingerprint()
    {
        var baseline = ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(Service(1000m), "G"));

        Assert.NotEqual(baseline, ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(Service(1001m), "G")));
        Assert.NotEqual(baseline, ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(Service(1000m), "H")));
    }

    [Fact]
    public void A_Deletion_Changes_The_Fingerprint_So_The_Partner_Hears_Of_It()
    {
        var service = Service();
        var before = ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(service, "G"));

        service.SetDeleted(true);

        Assert.NotEqual(before, ServiceCatalogPayload.Fingerprint(ServiceCatalogPayload.From(service, "G")));
    }
}

public class ServiceCodeTests
{
    [Fact]
    public void Draws_Five_Letters_Or_Digits()
    {
        var code = ServiceCode.Next(ServiceCode.NewTakenSet([]));

        Assert.Equal(ServiceCode.Length, code.Length);
        Assert.True(code.All(char.IsAsciiLetterOrDigit));
    }

    [Fact]
    public void Adds_What_It_Draws_So_A_Batch_Never_Repeats()
    {
        var taken = ServiceCode.NewTakenSet(["abcde", null, " "]);

        var codes = Enumerable.Range(0, 200).Select(_ => ServiceCode.Next(taken)).ToList();

        Assert.Equal(200, codes.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(201, taken.Count);
    }

    [Fact]
    public void The_Taken_Set_Ignores_Case()
    {
        var taken = ServiceCode.NewTakenSet(["VLE8y"]);

        Assert.Contains("vle8Y", taken);
    }
}
