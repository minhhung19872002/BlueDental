using System.Reflection;
using BlueDental.Appointments;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Appointments;

public class AppointmentAppServiceContractTests
{
    private readonly Type _serviceType = typeof(AppointmentAppService);
    private readonly Type _interfaceType = typeof(IAppointmentAppService);

    [Fact]
    public void AppointmentAppService_Should_Implement_IAppointmentAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void AppointmentAppService_Should_Inherit_ApplicationService()
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
    public void CreateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateAsync");
        method.ShouldNotBeNull();
        method.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateAppointmentDto_Should_Have_Required_Properties()
    {
        var dto = typeof(CreateAppointmentDto);
        dto.GetProperty("PatientId").ShouldNotBeNull();
        dto.GetProperty("DentistId").ShouldNotBeNull();
        dto.GetProperty("SlotStart").ShouldNotBeNull();
        dto.GetProperty("SlotEnd").ShouldNotBeNull();
        dto.GetProperty("BranchId").ShouldNotBeNull();
    }
}
