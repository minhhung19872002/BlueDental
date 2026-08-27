using System.Reflection;
using BlueDental.CustomerCare;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

public class CustomerCareAppServiceContractTests
{
    private readonly Type _serviceType = typeof(CustomerCareAppService);
    private readonly Type _interfaceType = typeof(ICustomerCareAppService);

    [Fact]
    public void CustomerCareAppService_Should_Implement_ICustomerCareAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CustomerCareAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void CustomerCareAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetListAsync")]
    [InlineData("GetStatsAsync")]
    [InlineData("GetAsync")]
    [InlineData("CreateAsync")]
    [InlineData("UpdateAsync")]
    [InlineData("MarkContactedAsync")]
    [InlineData("SucceedAsync")]
    [InlineData("FailAsync")]
    [InlineData("MarkZaloSentAsync")]
    [InlineData("CancelAsync")]
    [InlineData("ExportAsync")]
    [InlineData("GetGroupingPatientsAsync")]
    public void Interface_Should_Expose_Method(string methodName)
    {
        _interfaceType.GetMethod(methodName).ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetAsync")]
    [InlineData("UpdateAsync")]
    [InlineData("MarkContactedAsync")]
    [InlineData("SucceedAsync")]
    [InlineData("FailAsync")]
    [InlineData("MarkZaloSentAsync")]
    [InlineData("CancelAsync")]
    public void Single_Record_Method_Should_Require_View_Or_Manage_Permission(string methodName)
    {
        var method = _serviceType.GetMethod(methodName);
        method.ShouldNotBeNull();
        method.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldNotBeNullOrWhiteSpace();
    }

    /// <summary>
    /// The reference's full-object PUT must be able to flip a finished card
    /// between Thành công and Thất bại via the care-result dialog.
    /// </summary>
    [Fact]
    public void UpdateDto_Should_Carry_Optional_Status()
    {
        var property = typeof(UpdateCareRecordDto).GetProperty("Status");
        property.ShouldNotBeNull();
        property.PropertyType.ShouldBe(typeof(CareStatus?));
    }

    /// <summary>Base tasks are created already-successful with a colour label.</summary>
    [Fact]
    public void CreateDto_Should_Carry_Status_And_Outcome()
    {
        typeof(CreateCareRecordDto).GetProperty("Status")!.PropertyType.ShouldBe(typeof(CareStatus));
        typeof(CreateCareRecordDto).GetProperty("Outcome")!.PropertyType.ShouldBe(typeof(CareOutcome));
    }

    [Fact]
    public void GroupingPatientDto_Should_Carry_The_Twelve_Column_Rollups()
    {
        var dto = typeof(CareGroupingPatientDto);
        foreach (var name in new[]
                 {
                     "Code", "Name", "Phone", "TreatmentStatus", "ServiceNames", "StaffNames",
                     "TotalAmount", "TotalRevenue", "TotalDebt",
                     "NextAppointmentAt", "LastVisitAt", "CreatedAt",
                 })
        {
            dto.GetProperty(name).ShouldNotBeNull($"CareGroupingPatientDto must expose {name}");
        }
    }
}

public class CareRecordBehaviorTests
{
    private static CareRecord NewRecord(CareType type = CareType.Special) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), type, "Customer Care - special");

    /// <summary>Periodic/special dialogs send scheduleStartTime == scheduleToTime.</summary>
    [Fact]
    public void Schedule_Should_Allow_Equal_Endpoints()
    {
        var at = DateTimeOffset.UtcNow;
        var record = NewRecord().Schedule(at, at);

        record.ScheduledStart.ShouldBe(at);
        record.ScheduledEnd.ShouldBe(at);
        record.DueAt.ShouldBe(at);
    }

    [Fact]
    public void Schedule_Should_Reject_End_Before_Start()
    {
        var at = DateTimeOffset.UtcNow;
        Should.Throw<BusinessException>(() => NewRecord().Schedule(at, at.AddMinutes(-1)));
    }

    /// <summary>The care-result dialog can flip a finished card the other way.</summary>
    [Fact]
    public void RecordResult_Should_Flip_A_Finished_Record()
    {
        var record = NewRecord();
        record.RecordResult(success: true, note: "đã gọi");
        record.Status.ShouldBe(CareStatus.Succeeded);

        record.RecordResult(success: false, note: "gọi lại không nghe");
        record.Status.ShouldBe(CareStatus.Failed);
        record.Description.ShouldBe("gọi lại không nghe");
    }

    [Fact]
    public void RecordResult_Should_Reject_A_Cancelled_Record()
    {
        var record = NewRecord();
        record.Cancel("khách không còn nhu cầu");
        Should.Throw<BusinessException>(() => record.RecordResult(true, null));
    }

    /// <summary>The full-object PUT: a terminal status records a result…</summary>
    [Fact]
    public void ApplyResult_Should_Record_A_Result_For_A_Terminal_Status()
    {
        var record = NewRecord().ApplyResult(CareStatus.Failed, "không nghe máy");

        record.Status.ShouldBe(CareStatus.Failed);
        record.Description.ShouldBe("không nghe máy");
        record.CompletedAt.ShouldNotBeNull();
    }

    /// <summary>…and anything else is an inline note edit keeping the status.</summary>
    [Fact]
    public void ApplyResult_Should_Only_Edit_The_Note_For_A_Non_Terminal_Status()
    {
        var record = NewRecord().ApplyResult(null, "ghi chú inline");

        record.Status.ShouldBe(CareStatus.New);
        record.Description.ShouldBe("ghi chú inline");
        record.CompletedAt.ShouldBeNull();
    }

    /// <summary>Inline Ghi chú saves on blur even for finished rows.</summary>
    [Fact]
    public void UpdateNote_Should_Work_On_A_Succeeded_Record_Without_Changing_Status()
    {
        var record = NewRecord();
        record.RecordResult(success: true, note: null);

        record.UpdateNote("ghi chú mới");

        record.Status.ShouldBe(CareStatus.Succeeded);
        record.Description.ShouldBe("ghi chú mới");
    }

    /// <summary>Base tasks carry only a colour label, so the outcome is free-form.</summary>
    [Fact]
    public void Succeed_Should_Accept_NotRated_Outcome()
    {
        var record = NewRecord(CareType.Base).Succeed(CareOutcome.NotRated);
        record.Status.ShouldBe(CareStatus.Succeeded);
        record.Outcome.ShouldBe(CareOutcome.NotRated);
    }
}
