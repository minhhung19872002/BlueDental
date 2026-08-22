using System.Reflection;
using BlueDental.CustomerCare;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

public class CustomerCareAppServiceContractTests
{
    private readonly Type _serviceType = typeof(CustomerCareAppService);
    private readonly Type _interfaceType = typeof(ICustomerCareAppService);

    [Fact]
    public void CustomerCareAppService_Should_Implement_ICustomerCareAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CustomerCareAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CustomerCareAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
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
}
