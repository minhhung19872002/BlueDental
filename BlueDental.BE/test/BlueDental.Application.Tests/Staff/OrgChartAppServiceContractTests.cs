using System.Reflection;
using BlueDental.Permissions;
using BlueDental.Staff;
using BlueDental.Timekeeping;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Staff;

/// <summary>
/// Sơ đồ tổ chức (F-67): every endpoint names the orgChart leaf it needs, and
/// the next unit code counts past the codes in use.
/// </summary>
public class OrgChartAppServiceContractTests
{
    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IOrgChartAppService).IsAssignableFrom(typeof(OrgChartAppService)).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(typeof(OrgChartAppService)).ShouldBeTrue();
    }

    [Fact]
    public void Reading_Needs_The_Read_Leaf()
    {
        typeof(OrgChartAppService).GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.OrgChart.Read);
    }

    [Theory]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.OrgChart.Create)]
    [InlineData("UpdateAsync", BlueDentalAbilityPermissions.OrgChart.Update)]
    [InlineData("DeleteAsync", BlueDentalAbilityPermissions.OrgChart.Delete)]
    [InlineData("ChangeRootHeadAsync", BlueDentalAbilityPermissions.OrgChart.Update)]
    [InlineData("AssignAsync", BlueDentalAbilityPermissions.OrgChart.Update)]
    public void Each_Write_Names_Its_Leaf(string method, string permission)
    {
        typeof(OrgChartAppService).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(permission);
    }

    [Theory]
    [InlineData(OrgUnitKind.Department, new string[0], "PB-001")]
    [InlineData(OrgUnitKind.Department, new[] { "PB-001", "pb-007", "TBS-020", "PB-X" }, "PB-008")]
    [InlineData(OrgUnitKind.DoctorTeam, new[] { "PB-004", "TBS-002" }, "TBS-003")]
    public void Next_Code_Counts_Past_The_Highest_In_Use(OrgUnitKind kind, string[] codes, string expected)
    {
        OrgChartAppService.NextCode(kind, codes).ShouldBe(expected);
    }

    [Fact]
    public void Schedule_Services_Take_The_Scope_Resolver()
    {
        // Lịch làm việc / Chấm công must narrow by the org chart (BA 2026-10-10).
        typeof(TimeKeepingAppService).GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(OrgChartScopeResolver));
        typeof(StaffAppService).GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(OrgChartScopeResolver));
    }
}
