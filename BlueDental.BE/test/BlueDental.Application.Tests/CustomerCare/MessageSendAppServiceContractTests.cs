using System.Reflection;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.BackgroundJobs;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>
/// CSKH ▸ Gửi tin nhắn (F-77): opening the screen needs cskhSend.read; "Gửi",
/// "Huỷ hẹn gửi" and "Gửi thử tới tôi" need cskhSend.create; the branch comes
/// through the access checker; the sending itself runs as a named background job.
/// </summary>
public class MessageSendAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MessageSendAppService);

    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IMessageSendAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void Reading_Needs_The_Read_Permission()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.CskhSend.Read);
    }

    [Theory]
    [InlineData(nameof(MessageSendAppService.CreateAsync))]
    [InlineData(nameof(MessageSendAppService.CancelAsync))]
    [InlineData(nameof(MessageSendAppService.SendTestAsync))]
    public void Sending_Needs_The_Create_Permission(string method)
    {
        _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.CskhSend.Create);
    }

    [Theory]
    [InlineData(nameof(MessageSendAppService.GetTemplatesAsync))]
    [InlineData(nameof(MessageSendAppService.GetListsAsync))]
    [InlineData(nameof(MessageSendAppService.GetRecipientsAsync))]
    [InlineData(nameof(MessageSendAppService.PreviewAsync))]
    [InlineData(nameof(MessageSendAppService.FindCustomersAsync))]
    [InlineData(nameof(MessageSendAppService.GetAsync))]
    [InlineData(nameof(MessageSendAppService.GetListAsync))]
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

    [Fact]
    public void The_Sender_Is_A_Named_Background_Job()
    {
        typeof(AsyncBackgroundJob<MessageSendJobArgs>).IsAssignableFrom(typeof(MessageSendJob)).ShouldBeTrue();
        BackgroundJobNameAttribute.GetName<MessageSendJobArgs>().ShouldBe("cskh.message-send");
    }
}
