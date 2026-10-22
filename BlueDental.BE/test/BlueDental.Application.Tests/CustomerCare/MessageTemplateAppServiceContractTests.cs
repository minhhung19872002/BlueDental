using System.Reflection;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>
/// CSKH ▸ Template tin nhắn (F-76): reading needs cskhTemplate.read, "Tạo mẫu
/// mới" and "Nhân bản" need create, saving an existing template needs update,
/// and the branch comes through the access checker, not the raw header.
/// </summary>
public class MessageTemplateAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MessageTemplateAppService);

    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IMessageTemplateAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void Reading_Needs_The_Read_Permission()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.CskhTemplate.Read);
    }

    [Theory]
    [InlineData(nameof(MessageTemplateAppService.CreateAsync), BlueDentalAbilityPermissions.CskhTemplate.Create)]
    [InlineData(nameof(MessageTemplateAppService.DuplicateAsync), BlueDentalAbilityPermissions.CskhTemplate.Create)]
    [InlineData(nameof(MessageTemplateAppService.UpdateAsync), BlueDentalAbilityPermissions.CskhTemplate.Update)]
    public void Writing_Needs_Its_Own_Permission(string method, string policy)
    {
        _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(policy);
    }

    [Theory]
    [InlineData(nameof(MessageTemplateAppService.GetListAsync))]
    [InlineData(nameof(MessageTemplateAppService.GetAsync))]
    [InlineData(nameof(MessageTemplateAppService.GetVariablesAsync))]
    [InlineData(nameof(MessageTemplateAppService.GetSampleCustomerAsync))]
    [InlineData(nameof(MessageTemplateAppService.PreviewAsync))]
    [InlineData(nameof(MessageTemplateAppService.GetZnsTemplatesAsync))]
    [InlineData(nameof(MessageTemplateAppService.GetZnsTemplateAsync))]
    [InlineData(nameof(MessageTemplateAppService.SyncZaloStatusAsync))]
    public void The_Rest_Only_Reads(string method)
    {
        _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>().ShouldBeNull();
    }

    [Fact]
    public void Branch_Scope_Goes_Through_The_Access_Checker()
    {
        _serviceType.GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(BranchAccessChecker));
    }
}
