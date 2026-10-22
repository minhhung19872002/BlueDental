using System.Reflection;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>
/// Tổng quan ▸ Thống kê CSKH (F-78): the page needs cskhStats.read, the Excel
/// cskhStats.export; the branch comes through the access checker and the
/// phones follow "Ẩn số điện thoại" both on screen and in the file.
/// </summary>
public class MessageStatsAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MessageStatsAppService);

    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IMessageStatsAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void Reading_Needs_The_Read_Permission()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.CskhStats.Read);
    }

    [Fact]
    public void The_Excel_Needs_The_Export_Permission()
    {
        _serviceType.GetMethod(nameof(MessageStatsAppService.ExportAsync))!.GetCustomAttribute<AuthorizeAttribute>()!
            .Policy.ShouldBe(BlueDentalAbilityPermissions.CskhStats.Export);
    }

    [Theory]
    [InlineData(nameof(MessageStatsAppService.GetOverviewAsync))]
    [InlineData(nameof(MessageStatsAppService.GetTemplateOptionsAsync))]
    [InlineData(nameof(MessageStatsAppService.GetBatchesAsync))]
    [InlineData(nameof(MessageStatsAppService.GetRecipientsAsync))]
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
    public void Phones_Are_Masked_On_Screen_And_In_The_File()
    {
        typeof(MessageStatsRecipientDto).GetProperty(nameof(MessageStatsRecipientDto.Phone))!
            .GetCustomAttribute<PatientPhoneAttribute>().ShouldNotBeNull();
        _serviceType.GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(PatientPhoneMasker));
    }

    [Fact]
    public void Paging_Is_Bounded()
    {
        var range = typeof(MessageStatsPagedInput).GetProperty(nameof(MessageStatsPagedInput.MaxResultCount))!
            .GetCustomAttribute<System.ComponentModel.DataAnnotations.RangeAttribute>()!;
        range.Maximum.ShouldBe(MessageStatsLimits.MaxPageSize);
    }
}
