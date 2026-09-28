using System;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Zalo;

public class ZaloOaAppServiceContractTests
{
    private readonly Type _serviceType = typeof(ZaloOaAppService);

    [Fact]
    public void Implements_the_contract_on_the_shared_base()
    {
        typeof(IZaloOaAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData(nameof(ZaloOaAppService.GetStatusAsync), BlueDentalPermissions.Tools.View)]
    [InlineData(nameof(ZaloOaAppService.GetMessagesAsync), BlueDentalPermissions.Tools.View)]
    [InlineData(nameof(ZaloOaAppService.GetMessageStatsAsync), BlueDentalPermissions.Tools.View)]
    [InlineData(nameof(ZaloOaAppService.GetConnectUrlAsync), BlueDentalPermissions.Tools.Manage)]
    [InlineData(nameof(ZaloOaAppService.ImportBootstrapAsync), BlueDentalPermissions.Tools.Manage)]
    [InlineData(nameof(ZaloOaAppService.SetEnabledAsync), BlueDentalPermissions.Tools.Manage)]
    [InlineData(nameof(ZaloOaAppService.DisconnectAsync), BlueDentalPermissions.Tools.Manage)]
    [InlineData(nameof(ZaloOaAppService.RefreshTokenAsync), BlueDentalPermissions.Tools.Manage)]
    [InlineData(nameof(ZaloOaAppService.SendAsync), BlueDentalPermissions.CustomerCare.Manage)]
    public void Method_requires_its_permission(string method, string permission)
    {
        var attribute = _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>();

        attribute.ShouldNotBeNull();
        attribute!.Policy.ShouldBe(permission);
    }

    [Fact]
    public void Only_the_oauth_callback_is_anonymous()
    {
        foreach (var method in typeof(IZaloOaAppService).GetMethods())
        {
            var anonymous = _serviceType.GetMethod(method.Name)!.GetCustomAttribute<AllowAnonymousAttribute>() != null;
            anonymous.ShouldBe(method.Name == nameof(IZaloOaAppService.HandleCallbackAsync), method.Name);
        }
    }

    [Fact]
    public void Status_dto_never_carries_tokens()
    {
        foreach (var property in typeof(ZaloOaStatusDto).GetProperties())
        {
            property.Name.Contains("Token", StringComparison.OrdinalIgnoreCase)
                .ShouldBe(property.Name == nameof(ZaloOaStatusDto.HasBootstrapTokens)
                          || property.Name == nameof(ZaloOaStatusDto.AccessTokenExpiresAt),
                    property.Name + " must not expose a token");
        }
    }
}
