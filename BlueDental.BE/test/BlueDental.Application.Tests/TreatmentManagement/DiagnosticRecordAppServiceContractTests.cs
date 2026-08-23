using System.Reflection;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class DiagnosticRecordAppServiceContractTests
{
    private readonly Type _serviceType = typeof(DiagnosticRecordAppService);
    private readonly Type _interfaceType = typeof(IDiagnosticRecordAppService);

    [Fact]
    public void DiagnosticRecordAppService_Should_Implement_IDiagnosticRecordAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void DiagnosticRecordAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void DiagnosticRecordAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetListAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("CreateAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("DeleteAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }
}
