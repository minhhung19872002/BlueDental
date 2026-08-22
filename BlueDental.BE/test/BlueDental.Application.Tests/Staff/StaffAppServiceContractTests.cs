using System.Reflection;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Staff;

public class StaffAppServiceContractTests
{
    private readonly Type _serviceType = typeof(StaffAppService);
    private readonly Type _interfaceType = typeof(IStaffAppService);

    [Fact]
    public void StaffAppService_Should_Implement_IStaffAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void StaffAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void StaffAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void StaffDto_Should_Have_Required_Fields()
    {
        var dto = typeof(StaffDto);
        dto.GetProperty("Id").ShouldNotBeNull();
        dto.GetProperty("Name").ShouldNotBeNull();
        dto.GetProperty("UserName").ShouldNotBeNull();
        dto.GetProperty("IsActive").ShouldNotBeNull();
    }
}
