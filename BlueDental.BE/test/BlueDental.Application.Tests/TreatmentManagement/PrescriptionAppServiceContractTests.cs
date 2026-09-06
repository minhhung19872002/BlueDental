using System.Reflection;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class PrescriptionAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PrescriptionAppService);
    private readonly Type _interfaceType = typeof(IPrescriptionAppService);

    [Fact]
    public void PrescriptionAppService_Should_Implement_IPrescriptionAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PrescriptionAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PrescriptionAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetListAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.Prescription.Read)]
    [InlineData("GetAsync", BlueDentalAbilityPermissions.Prescription.Read)]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.Prescription.Create)]
    [InlineData("UpdateAsync", BlueDentalAbilityPermissions.Prescription.Update)]
    [InlineData("DeleteAsync", BlueDentalAbilityPermissions.Prescription.Delete)]
    public void Each_Operation_Should_Require_Its_Own_Permission(string method, string permission)
    {
        _interfaceType.GetMethod(method).ShouldNotBeNull();

        _serviceType.GetMethod(method)
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull()
            .Policy.ShouldBe(permission);
    }

    [Theory]
    [InlineData("DispenseAsync")]
    [InlineData("CancelAsync")]
    [InlineData("ExportPdfAsync")]
    public void Reference_Has_No_Such_Operation(string method)
    {
        // The reference offers Sửa / Xoá only — no dispense, cancel or print.
        _interfaceType.GetMethod(method).ShouldBeNull();
    }

    [Fact]
    public void Create_Dto_Should_Mirror_The_Reference_Dialog()
    {
        var dto = typeof(CreatePrescriptionDto);

        foreach (var field in new[]
                 {
                     "PatientId", "ClinicBranchId", "StaffId", "DiagnosisText", "Note",
                     "TreatmentType", "FollowUpDate", "SaveAsTemplate", "TemplateName", "Items"
                 })
        {
            dto.GetProperty(field).ShouldNotBeNull(field);
        }

        dto.GetProperty("Status").ShouldBeNull();
        dto.GetProperty("PatientDiagnosisId").ShouldBeNull();
    }

    [Fact]
    public void Item_Dto_Should_Dose_Like_A_Template_Line()
    {
        var dto = typeof(CreatePrescriptionItemDto);

        foreach (var field in new[] { "MedicationId", "TimesPerDay", "AmountPerTime", "Days", "Usage", "OtherUsage" })
        {
            dto.GetProperty(field).ShouldNotBeNull(field);
        }

        dto.GetProperty("Quantity").ShouldBeNull();
        dto.GetProperty("Dosage").ShouldBeNull();
    }
}
