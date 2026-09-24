using System.Reflection;
using BlueDental.Catalogs;
using BlueDental.Catalogs.Import;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Catalogs;

public class CatalogImportAppServiceContractTests
{
    private readonly Type _serviceType = typeof(CatalogImportAppService);
    private readonly Type _interfaceType = typeof(ICatalogImportAppService);

    [Fact]
    public void CatalogImportAppService_Should_Implement_ICatalogImportAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CatalogImportAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CatalogImportAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetTemplateAsync")]
    [InlineData("ImportAsync")]
    [InlineData("GetErrorFileAsync")]
    public void Method_Should_Exist_On_Interface(string method)
    {
        _interfaceType.GetMethod(method).ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetTemplateAsync", BlueDentalPermissions.Catalogs.View)]
    [InlineData("ImportAsync", BlueDentalPermissions.Catalogs.Create)]
    [InlineData("GetErrorFileAsync", BlueDentalPermissions.Catalogs.Create)]
    public void Method_Should_Require_The_Tab_Permission(string method, string permission)
    {
        // The owner's decision: no separate "import" leaf — writing rows needs
        // the same create right as the "Thêm" button, reading the template only view.
        _serviceType.GetMethod(method)
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull()
            .Policy.ShouldBe(permission);
    }

    [Fact]
    public void Row_Action_Numbers_Should_Match_The_Frontend_Mirror()
    {
        // IMPORT_ROW_ACTION in taxonomyApi.ts hard-codes these; Update was
        // appended after Error so the earlier ones never moved.
        ((int)CatalogImportRowAction.Create).ShouldBe(0);
        ((int)CatalogImportRowAction.Skip).ShouldBe(1);
        ((int)CatalogImportRowAction.Restore).ShouldBe(2);
        ((int)CatalogImportRowAction.Line).ShouldBe(3);
        ((int)CatalogImportRowAction.Error).ShouldBe(4);
        ((int)CatalogImportRowAction.Update).ShouldBe(5);
    }

    [Fact]
    public void Result_Should_Count_Updates_Separately()
    {
        typeof(CatalogImportResultDto).GetProperty("UpdateCount").ShouldNotBeNull().PropertyType.ShouldBe(typeof(int));
    }

    [Fact]
    public void Import_Should_Cover_Exactly_The_Agreed_Tabs()
    {
        // Bệnh án mẫu is deferred; thẻ hồ sơ and phương thức thanh toán are not taxonomy groups at all.
        ImportLayout.SupportedGroups.ShouldBe(
        [
            TaxonomyGroups.CareService,
            TaxonomyGroups.Diagnosis,
            TaxonomyGroups.MedicationType,
            TaxonomyGroups.ConsultingData,
            TaxonomyGroups.Source,
            TaxonomyGroups.DiseaseHistory,
            TaxonomyGroups.Occupation,
            TaxonomyGroups.PrescriptionTemplate
        ], ignoreOrder: true);

        ImportLayout.For(TaxonomyGroups.MedicalRecordTemplate).ShouldBeNull();
        ImportLayout.For(TaxonomyGroups.Supplies).ShouldBeNull();
    }

    [Fact]
    public void Prescription_Template_Layout_Should_Have_A_Lines_Sheet()
    {
        var layout = ImportLayout.For(TaxonomyGroups.PrescriptionTemplate).ShouldNotBeNull();
        layout.Lines.ShouldNotBeNull();
        layout.Entries.Has(ImportLayout.Col.Group).ShouldBeFalse();
        ImportLayout.For(TaxonomyGroups.Source).ShouldNotBeNull().Lines.ShouldBeNull();
    }
}
