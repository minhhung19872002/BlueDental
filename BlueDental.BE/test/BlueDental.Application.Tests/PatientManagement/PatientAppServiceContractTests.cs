using System.Reflection;
using BlueDental.PatientManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.PatientManagement;

public class PatientAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PatientAppService);
    private readonly Type _interfaceType = typeof(IPatientAppService);

    [Fact]
    public void PatientAppService_Should_Implement_IPatientAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetListAsync");
        method.ShouldNotBeNull();
        method.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RegisterAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("RegisterAsync");
        method.ShouldNotBeNull();
        method.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RegisterPatientDto_Should_Have_Required_Properties()
    {
        var dto = typeof(RegisterPatientDto);
        dto.GetProperty("FirstName").ShouldNotBeNull();
        dto.GetProperty("LastName").ShouldNotBeNull();
        dto.GetProperty("DateOfBirth").ShouldNotBeNull();
        dto.GetProperty("Gender").ShouldNotBeNull();
        dto.GetProperty("PhoneNumber").ShouldNotBeNull();

        // The branch is taken from the signed-in user, never from the request —
        // accepting it here is the IDOR the audit closed.
        dto.GetProperty("BranchId").ShouldBeNull();
    }

    [Fact]
    public void GetPatientListInput_Should_Filter_Without_Accepting_A_Branch()
    {
        var dto = typeof(GetPatientListInput);
        dto.GetProperty("Filter").ShouldNotBeNull();
        dto.GetProperty("BranchId").ShouldBeNull();
    }
}
