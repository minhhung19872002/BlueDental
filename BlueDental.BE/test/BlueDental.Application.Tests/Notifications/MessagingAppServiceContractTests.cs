using System.Reflection;
using BlueDental.Notifications;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Notifications;

public class MessagingAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MessagingAppService);
    private readonly Type _interfaceType = typeof(IMessagingAppService);

    [Fact]
    public void MessagingAppService_Should_Implement_IMessagingAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void MessagingAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void MessagingAppService_Should_Require_Authorization_At_Class_Level()
    {
        var attribute = _serviceType.GetCustomAttribute<AuthorizeAttribute>();
        attribute.ShouldNotBeNull();
        attribute.Policy.ShouldNotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData("GetSmsTemplatesAsync")]
    [InlineData("GetClinicConfiguresAsync")]
    public void Interface_Should_Expose_Method(string methodName)
    {
        _interfaceType.GetMethod(methodName).ShouldNotBeNull();
    }

    /// <summary>Reference sends module=sms&amp;isEnabled=true for the CSKH dialog.</summary>
    [Fact]
    public void ConfigureInput_Should_Carry_Module_And_IsEnabled_Filters()
    {
        typeof(GetClinicConfiguresInput).GetProperty("Module")!.PropertyType.ShouldBe(typeof(string));
        typeof(GetClinicConfiguresInput).GetProperty("IsEnabled")!.PropertyType.ShouldBe(typeof(bool?));
    }

    [Fact]
    public void TemplateDto_Should_Carry_Content_For_The_Message_Textarea()
    {
        typeof(SmsTemplateDto).GetProperty("Content")!.PropertyType.ShouldBe(typeof(string));
    }
}

public class ClinicConfigureBehaviorTests
{
    [Fact]
    public void Configure_Should_Toggle_Enabled_State()
    {
        var configure = new ClinicConfigure(
            Guid.NewGuid(), Guid.NewGuid(), ClinicConfigure.SmsModule, "Kênh SMS");

        configure.IsEnabled.ShouldBeTrue();
        configure.Disable().IsEnabled.ShouldBeFalse();
        configure.Enable().IsEnabled.ShouldBeTrue();
    }
}
