using System.Reflection;
using BlueDental.Operations;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Operations;

public class OperationAppServiceContractTests
{
    private readonly Type _serviceType = typeof(OperationAppService);
    private readonly Type _interfaceType = typeof(IOperationAppService);

    [Fact]
    public void OperationAppService_Should_Implement_IOperationAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void OperationAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void OperationAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCategoryListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetCategoryListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateCategoryAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateCategoryAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCategoryAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteCategoryAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetArticleListAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("GetArticleListAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void CreateArticleAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("CreateArticleAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void UpdateArticleAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("UpdateArticleAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void DeleteArticleAsync_Should_Have_Authorize_Attribute()
    {
        var method = _serviceType.GetMethod("DeleteArticleAsync");
        method.ShouldNotBeNull();
        method!.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetCategoryListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetCategoryListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateCategoryAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateCategoryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteCategoryAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteCategoryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetArticleListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetArticleListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateArticleAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateArticleAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateArticleAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("UpdateArticleAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteArticleAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("DeleteArticleAsync").ShouldNotBeNull();
    }
}
