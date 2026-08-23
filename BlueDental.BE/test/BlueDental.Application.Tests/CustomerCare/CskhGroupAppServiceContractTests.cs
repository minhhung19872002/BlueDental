using System.Reflection;
using BlueDental.CustomerCare;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

public class CskhGroupAppServiceContractTests
{
    private readonly Type _serviceType = typeof(CskhGroupAppService);
    private readonly Type _interfaceType = typeof(ICskhGroupAppService);

    [Fact]
    public void CskhGroupAppService_Should_Implement_ICskhGroupAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CskhGroupAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CskhGroupAppService_Should_Require_Authorization_At_Class_Level()
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
    public void GetAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetAsync");
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
    public void UpdateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("UpdateAsync");
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
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("UpdateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteAsync").ShouldNotBeNull();
    }
}
