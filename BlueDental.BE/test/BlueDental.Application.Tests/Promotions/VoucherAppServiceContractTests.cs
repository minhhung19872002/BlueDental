using System.Reflection;
using BlueDental.Promotions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Promotions;

public class VoucherAppServiceContractTests
{
    private readonly Type _serviceType = typeof(VoucherAppService);
    private readonly Type _interfaceType = typeof(IVoucherAppService);

    [Fact]
    public void VoucherAppService_Should_Implement_IVoucherAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void VoucherAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void VoucherAppService_Should_Require_Authorization_At_Class_Level()
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
    public void GetStatsAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetStatsAsync");
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
    public void GetAvailableAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetAvailableAsync");
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
    public void ActivateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("ActivateAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void PauseAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("PauseAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RedeemAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("RedeemAsync");
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
    public void ExpireOutdatedAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("ExpireOutdatedAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetStatsAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetStatsAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAvailableAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAvailableAsync").ShouldNotBeNull();
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
    public void ActivateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("ActivateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void PauseAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("PauseAsync").ShouldNotBeNull();
    }

    [Fact]
    public void RedeemAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("RedeemAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteAsync").ShouldNotBeNull();
    }

    [Fact]
    public void ExpireOutdatedAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("ExpireOutdatedAsync").ShouldNotBeNull();
    }
}
