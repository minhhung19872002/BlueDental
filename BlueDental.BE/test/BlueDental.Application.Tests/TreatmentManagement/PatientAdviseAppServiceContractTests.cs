using System.Reflection;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class PatientAdviseAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PatientAdviseAppService);
    private readonly Type _interfaceType = typeof(IPatientAdviseAppService);

    [Fact]
    public void PatientAdviseAppService_Should_Implement_IPatientAdviseAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientAdviseAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientAdviseAppService_Should_Require_Authorization_At_Class_Level()
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
    public void GetSummaryAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetSummaryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetSummaryAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetSummaryAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("GetAsync")
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
    public void UpdateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("UpdateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("UpdateAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void AcceptAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("AcceptAsync").ShouldNotBeNull();
    }

    [Fact]
    public void AcceptAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("AcceptAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void RejectAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("RejectAsync").ShouldNotBeNull();
    }

    [Fact]
    public void RejectAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("RejectAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void CancelAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CancelAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CancelAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("CancelAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    [Fact]
    public void ApplyVoucherAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("ApplyVoucherAsync").ShouldNotBeNull();
    }

    [Fact]
    public void ApplyVoucherAsync_Should_Have_Authorize_Attribute()
    {
        _serviceType.GetMethod("ApplyVoucherAsync")
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
