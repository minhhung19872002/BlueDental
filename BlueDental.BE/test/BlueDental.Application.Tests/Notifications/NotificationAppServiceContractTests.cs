using System.Reflection;
using BlueDental.Notifications;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Notifications;

public class NotificationAppServiceContractTests
{
    private readonly Type _serviceType = typeof(NotificationAppService);
    private readonly Type _interfaceType = typeof(INotificationAppService);

    [Fact]
    public void NotificationAppService_Should_Implement_INotificationAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void NotificationAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void NotificationAppService_Should_Require_Authorization_At_Class_Level()
    {
        // NotificationAppService uses bare [Authorize] without a specific permission policy
        var attr = _serviceType.GetCustomAttribute<AuthorizeAttribute>();
        attr.ShouldNotBeNull();
    }

    [Fact]
    public void GetMyNotificationsAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetMyNotificationsAsync").ShouldNotBeNull();
    }

    [Fact]
    public void MarkReadAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("MarkReadAsync").ShouldNotBeNull();
    }

    [Fact]
    public void MarkAllReadAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("MarkAllReadAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetMyNotificationsAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("GetMyNotificationsAsync").ShouldNotBeNull();
    }

    [Fact]
    public void MarkReadAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("MarkReadAsync").ShouldNotBeNull();
    }

    [Fact]
    public void MarkAllReadAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("MarkAllReadAsync").ShouldNotBeNull();
    }
}
