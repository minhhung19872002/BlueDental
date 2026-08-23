using System.Reflection;
using BlueDental.Tools;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Tools;

public class ToolsAppServiceContractTests
{
    private readonly Type _serviceType = typeof(ToolsAppService);
    private readonly Type _interfaceType = typeof(IToolsAppService);

    [Fact]
    public void ToolsAppService_Should_Implement_IToolsAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void ToolsAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void ToolsAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCallAssignmentListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetCallAssignmentListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateCallAssignmentAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateCallAssignmentAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void UpdateCallAssignmentStatusAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("UpdateCallAssignmentStatusAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCallAssignmentAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteCallAssignmentAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCallLogListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetCallLogListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateCallLogAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateCallLogAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCallLogAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteCallLogAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetMessageTemplateListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetMessageTemplateListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateMessageTemplateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateMessageTemplateAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void UpdateMessageTemplateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("UpdateMessageTemplateAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteMessageTemplateAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteMessageTemplateAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetMessageLogListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetMessageLogListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCallAssignmentListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetCallAssignmentListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateCallAssignmentAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateCallAssignmentAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateCallAssignmentStatusAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("UpdateCallAssignmentStatusAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCallAssignmentAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteCallAssignmentAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetCallLogListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetCallLogListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateCallLogAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateCallLogAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCallLogAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteCallLogAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetMessageTemplateListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetMessageTemplateListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateMessageTemplateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateMessageTemplateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateMessageTemplateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("UpdateMessageTemplateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteMessageTemplateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteMessageTemplateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetMessageLogListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetMessageLogListAsync").ShouldNotBeNull();
    }
}
