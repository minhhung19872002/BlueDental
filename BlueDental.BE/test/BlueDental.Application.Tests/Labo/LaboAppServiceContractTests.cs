using System.Reflection;
using BlueDental.Labo;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;
using Xunit;

namespace BlueDental.Application.Tests.Labo;

public class LaboAppServiceContractTests
{
    private readonly Type _serviceType = typeof(LaboAppService);
    private readonly Type _interfaceType = typeof(ILaboAppService);

    [Fact]
    public void LaboAppService_Should_Implement_ILaboAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void LaboAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void LaboAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateLaboOrderDto_Should_Have_Required_Fields()
    {
        var dto = typeof(CreateLaboOrderDto);
        dto.GetProperty("PatientId").ShouldNotBeNull();
        dto.GetProperty("BranchId").ShouldNotBeNull();
        dto.GetProperty("LabProviderName").ShouldNotBeNull();
    }

    [Fact]
    public void CreateLaboOrderDto_Should_Carry_ParentOrderId_For_Child_Orders()
    {
        typeof(CreateLaboOrderDto).GetProperty("ParentOrderId")!
            .PropertyType.ShouldBe(typeof(Guid?));
    }

    [Fact]
    public void CreateLaboOrderDto_Should_Carry_The_Dialog_Pictures()
    {
        typeof(CreateLaboOrderDto).GetProperty("Pictures")!
            .PropertyType.ShouldBe(typeof(List<IRemoteStreamContent>));
    }

    [Fact]
    public void LaboOrderDto_Should_Expose_What_The_Child_Form_Prefills()
    {
        var dto = typeof(LaboOrderDto);
        foreach (var name in new[]
                 {
                     "ParentOrderId", "TreatmentPlanId", "TreatmentPlanCode",
                     "TreatmentPlanDentistName", "TreatmentServiceName", "TreatmentServiceStatus",
                     "BiteName", "FinishLineName", "RhythmName", "LaboServiceName"
                 })
        {
            dto.GetProperty(name).ShouldNotBeNull(name);
        }
    }
}
