using System.Reflection;
using BlueDental.Appointments;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Appointments;

/// <summary>
/// F-65 "Lặp lại lịch hẹn": previewing and booking a series need the create
/// permission, reading one the read permission, and the service localises
/// through the shared base (raw keys otherwise, R-525).
/// </summary>
public class AppointmentSeriesAppServiceContractTests
{
    private readonly Type _serviceType = typeof(AppointmentSeriesAppService);

    [Fact]
    public void Implements_Its_Contract_On_The_Shared_Base()
    {
        typeof(IAppointmentSeriesAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        _serviceType.IsSubclassOf(typeof(BlueDentalAppService)).ShouldBeTrue();
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData(nameof(AppointmentSeriesAppService.PreviewAsync), BlueDentalAbilityPermissions.Appointment.Create)]
    [InlineData(nameof(AppointmentSeriesAppService.CreateAsync), BlueDentalAbilityPermissions.Appointment.Create)]
    [InlineData(nameof(AppointmentSeriesAppService.GetByAppointmentAsync), BlueDentalAbilityPermissions.Appointment.Read)]
    public void Every_Endpoint_Names_Its_Permission(string method, string policy)
    {
        var attribute = _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>();
        attribute.ShouldNotBeNull();
        attribute.Policy.ShouldBe(policy);
    }

    [Fact]
    public void Contract_Has_Only_Preview_Create_And_Read()
    {
        typeof(IAppointmentSeriesAppService).GetMethods().Select(m => m.Name)
            .ShouldBe(["PreviewAsync", "CreateAsync", "GetByAppointmentAsync"], ignoreOrder: true);
    }
}
