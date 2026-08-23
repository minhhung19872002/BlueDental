using System.Reflection;
using BlueDental.Timekeeping;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Timekeeping;

public class TimeKeepingAppServiceContractTests
{
    private readonly Type _serviceType = typeof(TimeKeepingAppService);
    private readonly Type _interfaceType = typeof(ITimeKeepingAppService);

    [Fact]
    public void TimeKeepingAppService_Should_Implement_ITimeKeepingAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void TimeKeepingAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void TimeKeepingAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetSummaryAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetSummaryAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void OpenWorkDayAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("OpenWorkDayAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RegisterWorkingAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("RegisterWorkingAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void RegisterDayOffAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("RegisterDayOffAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CheckInAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CheckInAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CheckOutAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CheckOutAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void AddOvertimeAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("AddOvertimeAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CloseAbandonedShiftsAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CloseAbandonedShiftsAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetSummaryAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetSummaryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void OpenWorkDayAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("OpenWorkDayAsync").ShouldNotBeNull();
    }

    [Fact]
    public void RegisterWorkingAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("RegisterWorkingAsync").ShouldNotBeNull();
    }

    [Fact]
    public void RegisterDayOffAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("RegisterDayOffAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CheckInAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CheckInAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CheckOutAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CheckOutAsync").ShouldNotBeNull();
    }

    [Fact]
    public void AddOvertimeAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("AddOvertimeAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CloseAbandonedShiftsAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CloseAbandonedShiftsAsync").ShouldNotBeNull();
    }
}
