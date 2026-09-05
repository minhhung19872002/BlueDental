using System.Reflection;
using BlueDental.Appointments;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Appointments;

public class AppointmentChangeLogAppServiceContractTests
{
    private readonly Type _serviceType = typeof(AppointmentChangeLogAppService);

    [Fact]
    public void Should_Implement_Interface_And_Inherit_ApplicationService()
    {
        typeof(IAppointmentChangeLogAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void Reading_History_Requires_The_Appointment_Read_Permission()
    {
        var attribute = _serviceType.GetCustomAttribute<AuthorizeAttribute>();
        attribute.ShouldNotBeNull();
        attribute.Policy.ShouldBe(BlueDentalAbilityPermissions.Appointment.Read);
    }

    [Fact]
    public void Service_Is_Read_Only()
    {
        var methods = typeof(IAppointmentChangeLogAppService).GetMethods().Select(m => m.Name).ToList();
        methods.ShouldBe(["GetListAsync", "GetStatsAsync"], ignoreOrder: true);
    }

    [Fact]
    public void List_Input_Carries_Every_Filter_The_Dialog_Has()
    {
        var input = typeof(GetAppointmentChangeLogListInput);
        foreach (var name in new[]
                 {
                     "PatientId", "AppointmentId", "FromDate", "ToDate", "Action", "Actions", "Status",
                     "Statuses", "Source", "Sources", "Actor", "Keyword", "ImportantOnly", "SkipCount",
                     "MaxResultCount",
                 })
        {
            input.GetProperty(name).ShouldNotBeNull(name);
        }
    }

    [Fact]
    public void Row_Dto_Carries_Before_After_And_Diff()
    {
        var dto = typeof(AppointmentChangeLogDto);
        dto.GetProperty("Before")!.PropertyType.ShouldBe(typeof(AppointmentSnapshotDto));
        dto.GetProperty("After")!.PropertyType.ShouldBe(typeof(AppointmentSnapshotDto));
        dto.GetProperty("Diff")!.PropertyType.ShouldBe(typeof(List<AppointmentFieldChangeDto>));
        dto.GetProperty("ChangedFields")!.PropertyType.ShouldBe(typeof(List<string>));
        foreach (var name in new[]
                 {
                     "Action", "Source", "StatusBefore", "StatusAfter", "IsImportant", "ActorName",
                     "ActorUserName", "ActorRole", "IpAddress", "Browser", "OperatingSystem", "OccurredAt",
                 })
        {
            dto.GetProperty(name).ShouldNotBeNull(name);
        }
    }

    [Fact]
    public void Stats_Dto_Breaks_Down_By_Action_And_Resulting_Status()
    {
        var dto = typeof(AppointmentChangeLogStatsDto);
        dto.GetProperty("Total").ShouldNotBeNull();
        dto.GetProperty("ByAction")!.PropertyType.ShouldBe(typeof(Dictionary<AppointmentChangeAction, int>));
        dto.GetProperty("ByStatusTo")!.PropertyType.ShouldBe(typeof(Dictionary<AppointmentStatus, int>));
        dto.GetProperty("BySource")!.PropertyType.ShouldBe(typeof(Dictionary<AppointmentChangeSource, int>));
    }

    [Fact]
    public void Appointment_Service_Records_History_Through_The_Recorder()
    {
        // Every write path of AppointmentAppService goes through the recorder;
        // this pins the dependency so it cannot be dropped silently.
        typeof(AppointmentAppService).GetConstructors().Single().GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(AppointmentChangeRecorder));
    }
}

public class UserAgentSummaryTests
{
    [Theory]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Chrome", "Windows", false)]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
        "Edge", "Windows", false)]
    [InlineData(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Safari", "iOS", true)]
    [InlineData(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        "Chrome", "Android", true)]
    [InlineData(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/129.0",
        "Firefox", "macOS", false)]
    public void Parses_Browser_System_And_Mobile(string ua, string browser, string os, bool mobile)
    {
        var summary = UserAgentSummary.Parse(ua);
        summary.Browser.ShouldBe(browser);
        summary.OperatingSystem.ShouldBe(os);
        summary.IsMobile.ShouldBe(mobile);
    }

    [Fact]
    public void Empty_User_Agent_Yields_Nothing()
    {
        var summary = UserAgentSummary.Parse(null);
        summary.Browser.ShouldBeNull();
        summary.OperatingSystem.ShouldBeNull();
        summary.IsMobile.ShouldBeFalse();
    }
}
