using System.Reflection;
using BlueDental.Finance;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Finance;

public class CashManagementAppServiceContractTests
{
    private readonly Type _serviceType = typeof(CashManagementAppService);
    private readonly Type _interfaceType = typeof(ICashManagementAppService);

    [Fact]
    public void CashManagementAppService_Should_Implement_ICashManagementAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CashManagementAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CashManagementAppService_Should_Have_Class_Level_Authorize_Attribute()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetBalanceAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetBalanceAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetOverviewAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetOverviewAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetEntriesAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetEntriesAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateEntryAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("CreateEntryAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteEntryAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("DeleteEntryAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }
}
