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

    [Theory]
    [InlineData("GetListAsync")]
    [InlineData("GetAsync")]
    [InlineData("GetAvailableAsync")]
    [InlineData("GetCodePrefixAsync")]
    [InlineData("CreateAsync")]
    [InlineData("CreateBatchAsync")]
    [InlineData("UpdateAsync")]
    [InlineData("PublishAsync")]
    [InlineData("UnpublishAsync")]
    [InlineData("RedeemAsync")]
    [InlineData("DeleteAsync")]
    [InlineData("ExpireOutdatedAsync")]
    public void Method_Should_Have_Authorize_Attribute(string methodName)
    {
        var method = _serviceType.GetMethod(methodName);
        method.ShouldNotBeNull($"{methodName} should exist on VoucherAppService");
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull(
            $"{methodName} should have [Authorize]");
    }

    [Theory]
    [InlineData("GetListAsync")]
    [InlineData("GetAsync")]
    [InlineData("GetAvailableAsync")]
    [InlineData("GetCodePrefixAsync")]
    [InlineData("CreateAsync")]
    [InlineData("CreateBatchAsync")]
    [InlineData("UpdateAsync")]
    [InlineData("PublishAsync")]
    [InlineData("UnpublishAsync")]
    [InlineData("RedeemAsync")]
    [InlineData("DeleteAsync")]
    [InlineData("ExpireOutdatedAsync")]
    public void Method_Should_Exist_On_Interface(string methodName)
    {
        _interfaceType.GetMethod(methodName).ShouldNotBeNull(
            $"{methodName} should exist on IVoucherAppService");
    }

    [Fact]
    public void Removed_Methods_Should_Not_Exist()
    {
        _interfaceType.GetMethod("GetStatsAsync").ShouldBeNull();
        _interfaceType.GetMethod("ActivateAsync").ShouldBeNull();
        _interfaceType.GetMethod("PauseAsync").ShouldBeNull();
    }
}
