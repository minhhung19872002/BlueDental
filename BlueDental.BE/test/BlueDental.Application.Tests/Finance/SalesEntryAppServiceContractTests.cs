using System.Reflection;
using BlueDental.Finance;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Finance;

public class SalesEntryAppServiceContractTests
{
    private readonly Type _serviceType = typeof(SalesEntryAppService);
    private readonly Type _interfaceType = typeof(ISalesEntryAppService);

    [Fact]
    public void SalesEntryAppService_Should_Implement_ISalesEntryAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void SalesEntryAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void SalesEntryAppService_Should_Have_Class_Level_Authorize_Attribute()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetListAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetStatsAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetStatsAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("CreateAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void UpdateAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("UpdateAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void ApproveAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("ApproveAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RejectAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("RejectAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("DeleteAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }
}
