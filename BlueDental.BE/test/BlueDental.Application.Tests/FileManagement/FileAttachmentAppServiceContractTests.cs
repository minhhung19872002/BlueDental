using System.Reflection;
using BlueDental.FileManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.FileManagement;

public class FileAttachmentAppServiceContractTests
{
    private readonly Type _serviceType = typeof(FileAttachmentAppService);
    private readonly Type _interfaceType = typeof(IFileAttachmentAppService);

    [Fact]
    public void FileAttachmentAppService_Should_Implement_IFileAttachmentAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void FileAttachmentAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void FileAttachmentAppService_Should_Have_Class_Level_Authorize_Attribute()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_As_Public_Method()
    {
        _serviceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAsync_Should_Exist_As_Public_Method()
    {
        _serviceType.GetMethod("GetAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Exist_As_Public_Method()
    {
        _serviceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void DeleteAsync_Should_Exist_As_Public_Method()
    {
        _serviceType.GetMethod("DeleteAsync").ShouldNotBeNull();
    }
}
