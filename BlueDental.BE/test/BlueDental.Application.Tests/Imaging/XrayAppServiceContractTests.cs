using System;
using System.Linq;
using System.Reflection;
using BlueDental.Imaging;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Auditing;
using Xunit;

namespace BlueDental.Application.Tests.Imaging;

/// <summary>F-95: who may do what with the X-ray PCs and the pictures they send.</summary>
public class XrayAppServiceContractTests
{
    [Theory]
    [InlineData(typeof(XrayDeviceAppService), "GetListAsync", BlueDentalPermissions.Organizations.View)]
    [InlineData(typeof(XrayDeviceAppService), "CreateAsync", BlueDentalPermissions.Organizations.Edit)]
    [InlineData(typeof(XrayDeviceAppService), "RevokeAsync", BlueDentalPermissions.Organizations.Edit)]
    [InlineData(typeof(XrayDeviceAppService), "HasActiveAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData(typeof(XrayInboxAppService), "GetListAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData(typeof(XrayInboxAppService), "GetCountAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData(typeof(XrayInboxAppService), "GetContentAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData(typeof(XrayInboxAppService), "GetSuggestionsAsync", BlueDentalAbilityPermissions.TreatmentImage.Read)]
    [InlineData(typeof(XrayInboxAppService), "AssignAsync", BlueDentalAbilityPermissions.TreatmentImage.Create)]
    [InlineData(typeof(XrayInboxAppService), "DiscardAsync", BlueDentalAbilityPermissions.TreatmentImage.Delete)]
    public void Each_Method_Names_Its_Permission(Type service, string method, string permission)
    {
        service.GetMethods().Single(m => m.Name == method)
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }

    [Fact]
    public void The_Station_Is_Not_Audited_So_The_Token_Is_Not_Logged()
    {
        typeof(XrayStationAppService).GetCustomAttribute<DisableAuditingAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void No_Public_Method_Outside_The_Interfaces()
    {
        foreach (var (service, contract) in new[]
                 {
                     (typeof(XrayDeviceAppService), typeof(IXrayDeviceAppService)),
                     (typeof(XrayStationAppService), typeof(IXrayStationAppService)),
                     (typeof(XrayInboxAppService), typeof(IXrayInboxAppService)),
                 })
        {
            contract.IsAssignableFrom(service).ShouldBeTrue();
            service.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Select(m => m.Name).Distinct()
                .ShouldBeSubsetOf(contract.GetMethods().Select(m => m.Name));
        }
    }

    [Theory]
    [InlineData("NGUYEN_VAN_A", "nguyen van a")]
    [InlineData("  Nguyễn   Văn-A. ", "nguyễn văn a")]
    [InlineData("A", null)]
    [InlineData(null, null)]
    public void A_Name_Read_Off_A_File_Becomes_One_Search_Term(string? hint, string? expected)
    {
        XrayPatientMatcher.NameTerm(hint).ShouldBe(expected);
    }
}
