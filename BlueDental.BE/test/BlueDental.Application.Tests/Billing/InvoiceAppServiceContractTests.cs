using System.Reflection;
using BlueDental.Billing;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Billing;

public class InvoiceAppServiceContractTests
{
    private readonly Type _serviceType = typeof(InvoiceAppService);
    private readonly Type _interfaceType = typeof(IInvoiceAppService);

    [Fact]
    public void InvoiceAppService_Should_Implement_IInvoiceAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void InvoiceAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetListAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("CreateAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void IssueAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("IssueAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void VoidAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("VoidAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }
}
