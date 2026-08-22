using System.Reflection;
using BlueDental.Visits;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Visits;

public class VisitAppServiceContractTests
{
    private readonly Type _serviceType = typeof(VisitAppService);
    private readonly Type _interfaceType = typeof(IVisitAppService);

    [Fact]
    public void VisitAppService_Should_Implement_IVisitAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void VisitAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void VisitAppService_Should_Require_Authorization_At_Class_Level()
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
    public void CreateVisitDto_Should_Have_PatientId_And_BranchId()
    {
        var dto = typeof(CreateVisitDto);
        dto.GetProperty("PatientId").ShouldNotBeNull();
        dto.GetProperty("BranchId").ShouldNotBeNull();
        dto.GetProperty("ScheduledAt").ShouldNotBeNull();
    }
}
