using System.Reflection;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Staff;

/// <summary>
/// Each Chế tài endpoint names the staffPenalty leaf it needs, so the Phân
/// quyền tab's boxes are the ones the server actually checks.
/// </summary>
public class StaffPenaltyAppServiceContractTests
{
    [Fact]
    public void Services_Implement_Their_Interfaces()
    {
        typeof(IStaffPenaltyAppService).IsAssignableFrom(typeof(StaffPenaltyAppService)).ShouldBeTrue();
        typeof(IStaffViolationTypeAppService).IsAssignableFrom(typeof(StaffViolationTypeAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(StaffPenaltyAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(StaffViolationTypeAppService)).ShouldBeTrue();
    }

    [Theory]
    [InlineData(typeof(StaffPenaltyAppService))]
    [InlineData(typeof(StaffViolationTypeAppService))]
    public void Reading_Needs_The_Read_Leaf(System.Type service)
    {
        service.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.StaffPenalty.Read);
    }

    [Theory]
    [InlineData(typeof(StaffPenaltyAppService), "CreateAsync", BlueDentalAbilityPermissions.StaffPenalty.Create)]
    [InlineData(typeof(StaffPenaltyAppService), "UpdateAsync", BlueDentalAbilityPermissions.StaffPenalty.Update)]
    [InlineData(typeof(StaffPenaltyAppService), "DeleteAsync", BlueDentalAbilityPermissions.StaffPenalty.Delete)]
    [InlineData(typeof(StaffPenaltyAppService), "ApproveAsync", BlueDentalAbilityPermissions.StaffPenalty.Approve)]
    [InlineData(typeof(StaffPenaltyAppService), "CancelAsync", BlueDentalAbilityPermissions.StaffPenalty.Approve)]
    [InlineData(typeof(StaffViolationTypeAppService), "CreateAsync", BlueDentalAbilityPermissions.StaffPenalty.Create)]
    [InlineData(typeof(StaffViolationTypeAppService), "UpdateAsync", BlueDentalAbilityPermissions.StaffPenalty.Update)]
    [InlineData(typeof(StaffViolationTypeAppService), "DeleteAsync", BlueDentalAbilityPermissions.StaffPenalty.Delete)]
    public void Each_Write_Names_Its_Leaf(System.Type service, string method, string permission)
    {
        service.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }
}
