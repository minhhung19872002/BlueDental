using System.Reflection;
using BlueDental.Inventory;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Inventory;

public class MaterialAllocationAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MaterialAllocationAppService);
    private readonly Type _interfaceType = typeof(IMaterialAllocationAppService);

    [Fact]
    public void MaterialAllocationAppService_Should_Implement_IMaterialAllocationAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void MaterialAllocationAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void MaterialAllocationAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
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
    public void DeleteAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteAsync").ShouldNotBeNull();
    }
}
