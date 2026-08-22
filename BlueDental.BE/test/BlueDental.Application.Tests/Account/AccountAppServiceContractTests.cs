using System.Reflection;
using BlueDental.Account;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Account;

public class AccountAppServiceContractTests
{
    private readonly Type _serviceType = typeof(AccountAppService);
    private readonly Type _interfaceType = typeof(IAccountAppService);

    [Fact]
    public void AccountAppService_Should_Implement_IAccountAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void AccountAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void AccountAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCurrentUserAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetCurrentUserAsync").ShouldNotBeNull();
    }

    [Fact]
    public void ChangePasswordAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("ChangePasswordAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CurrentUserDto_Should_Have_Required_Fields()
    {
        var dto = typeof(CurrentUserDto);
        dto.GetProperty("Id").ShouldNotBeNull();
        dto.GetProperty("UserName").ShouldNotBeNull();
        dto.GetProperty("Roles").ShouldNotBeNull();
    }
}
