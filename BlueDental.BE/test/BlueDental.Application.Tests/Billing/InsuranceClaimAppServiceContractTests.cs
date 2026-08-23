using System.Reflection;
using BlueDental.Billing;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Billing;

public class InsuranceClaimAppServiceContractTests
{
    private readonly Type _serviceType = typeof(InsuranceClaimAppService);
    private readonly Type _interfaceType = typeof(IInsuranceClaimAppService);

    [Fact]
    public void InsuranceClaimAppService_Should_Implement_IInsuranceClaimAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void InsuranceClaimAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void InsuranceClaimAppService_Should_Have_Class_Level_Authorize_Attribute()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_GetListAsync()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_GetAsync()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_CreateAsync()
    {
        _interfaceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_SubmitAsync()
    {
        _interfaceType.GetMethod("SubmitAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_ApproveAsync()
    {
        _interfaceType.GetMethod("ApproveAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_RejectAsync()
    {
        _interfaceType.GetMethod("RejectAsync").ShouldNotBeNull();
    }

    [Fact]
    public void IInsuranceClaimAppService_Should_Declare_SettleAsync()
    {
        _interfaceType.GetMethod("SettleAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetListAsync")!
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
    public void SubmitAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("SubmitAsync")!
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
    public void SettleAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("SettleAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }
}
