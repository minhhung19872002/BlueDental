using System.Reflection;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class TreatmentPlanAppServiceContractTests
{
    private readonly Type _serviceType = typeof(TreatmentPlanAppService);
    private readonly Type _interfaceType = typeof(ITreatmentPlanAppService);

    [Fact]
    public void TreatmentPlanAppService_Should_Implement_ITreatmentPlanAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void GetListAsync_Should_Require_Authorization()
    {
        _serviceType.GetMethod("GetListAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Require_Authorization()
    {
        _serviceType.GetMethod("CreateAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateTreatmentPlanDto_Should_Have_PatientId()
    {
        typeof(CreateTreatmentPlanDto).GetProperty("PatientId").ShouldNotBeNull();
    }

    [Fact]
    public void TreatmentPlanDto_Should_Have_Status()
    {
        typeof(TreatmentPlanDto).GetProperty("Status").ShouldNotBeNull();
    }
}
