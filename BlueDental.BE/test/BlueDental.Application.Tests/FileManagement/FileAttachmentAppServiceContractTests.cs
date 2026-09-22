using System.Reflection;
using BlueDental.FileManagement;
using BlueDental.Permissions;
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

    /// <summary>
    /// Attachments are gated as treatment images (the closest subject the
    /// reference's ability tree offers), method by method, so a role with no
    /// grants cannot list, read, upload or delete them.
    /// </summary>
    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData("GetAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.TreatmentImage.Create)]
    [InlineData("DeleteAsync", BlueDentalAbilityPermissions.TreatmentImage.Delete)]
    public void Methods_Should_Require_TreatmentImage_Ability(string methodName, string expectedPolicy)
    {
        var method = _serviceType.GetMethod(methodName);
        method.ShouldNotBeNull();

        method.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(expectedPolicy);
    }
}
