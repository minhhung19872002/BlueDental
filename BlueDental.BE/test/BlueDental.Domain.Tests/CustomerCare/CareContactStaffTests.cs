using System;
using BlueDental.CustomerCare;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.CustomerCare;

/// <summary>
/// Bug list item 13 (2026-10-06): CSKH › Nhắc lịch hẹn — setting a task to
/// Đã liên hệ saved the state, but "Nhân viên chăm sóc" stayed "—". Whoever
/// changes the state is now recorded, with the moment.
/// </summary>
public class CareContactStaffTests
{
    private static readonly DateTimeOffset At = new(2026, 10, 6, 9, 30, 0, TimeSpan.Zero);

    private static CareRecord Open() =>
        CareRecord.AfterTreatment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new DateOnly(2026, 10, 4), [Guid.NewGuid()]);

    [Fact]
    public void Setting_Contacted_Records_Who_And_When()
    {
        var record = Open();
        var staff = Guid.NewGuid();

        record.SetContacted(true, At, staff).ShouldBeTrue();

        record.CareStaffId.ShouldBe(staff);
        record.ContactedAt.ShouldBe(At);
    }

    [Fact]
    public void Setting_It_Back_Clears_The_Moment_And_Keeps_Who_Touched_It()
    {
        var record = Open();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        record.SetContacted(true, At, first);

        record.SetContacted(false, At.AddHours(1), second).ShouldBeTrue();

        record.CareStaffId.ShouldBe(second);
        record.ContactedAt.ShouldBeNull();
    }

    [Fact]
    public void Re_Picking_The_Same_State_Changes_Nothing()
    {
        var record = Open();
        var first = Guid.NewGuid();
        record.SetContacted(true, At, first);

        record.SetContacted(true, At.AddHours(2), Guid.NewGuid()).ShouldBeFalse();

        record.CareStaffId.ShouldBe(first);
        record.ContactedAt.ShouldBe(At);
    }

    [Fact]
    public void The_Older_Mark_Contacted_Records_Them_Too()
    {
        var record = Open();
        var staff = Guid.NewGuid();

        record.MarkContacted(At, staff);

        record.CareStaffId.ShouldBe(staff);
        record.ContactedAt.ShouldBe(At);
    }
}
