using System;
using BlueDental.CustomerCare;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.CustomerCare;

/// <summary>
/// R-1024 (BA 2026-10-24): CSKH — a Zalo message sent to the customer turns a
/// task still "Chưa liên hệ" into "Đã liên hệ", by the sender, as if they had
/// picked it. A task past that point keeps its state; only the "đã gửi Zalo"
/// mark moves.
/// </summary>
public class CareZaloSentTests
{
    private static readonly DateTimeOffset At = new(2026, 10, 24, 9, 30, 0, TimeSpan.Zero);

    private static CareRecord AfterTreatment() =>
        CareRecord.AfterTreatment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new DateOnly(2026, 10, 20), [Guid.NewGuid()]);

    private static CareRecord Of(CareType type) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), type, "Chăm sóc",
            dueAt: At.AddDays(-1));

    [Theory]
    [InlineData(CareType.AppointmentReminder)]
    [InlineData(CareType.Birthday)]
    [InlineData(CareType.MissedAppointment)]
    [InlineData(CareType.Periodic)]
    [InlineData(CareType.NoService)]
    [InlineData(CareType.Complaint)]
    public void A_Task_Not_Yet_Reached_Turns_Contacted_By_The_Sender(CareType type)
    {
        var record = Of(type);
        var sender = Guid.NewGuid();

        record.MarkZaloSent(At, sender).ShouldBeTrue();

        record.Status.ShouldBe(CareStatus.Contacted);
        record.CareStaffId.ShouldBe(sender);
        record.ContactedAt.ShouldBe(At);
        record.ZaloSentAt.ShouldBe(At);
        record.DueAt.ShouldBe(At.AddDays(-1));
    }

    [Fact]
    public void After_Treatment_Takes_The_Send_As_Its_Care_Date()
    {
        var record = AfterTreatment();

        record.MarkZaloSent(At, Guid.NewGuid()).ShouldBeTrue();

        record.Status.ShouldBe(CareStatus.Contacted);
        record.DueAt.ShouldBe(At);
    }

    [Fact]
    public void A_Task_Already_Contacted_Keeps_Who_Reached_It()
    {
        var record = AfterTreatment();
        var caller = Guid.NewGuid();
        record.SetContacted(true, At, caller);

        record.MarkZaloSent(At.AddHours(2), Guid.NewGuid()).ShouldBeFalse();

        record.Status.ShouldBe(CareStatus.Contacted);
        record.CareStaffId.ShouldBe(caller);
        record.ContactedAt.ShouldBe(At);
        record.ZaloSentAt.ShouldBe(At.AddHours(2));
    }

    [Fact]
    public void A_Result_Already_Recorded_Stays()
    {
        var succeeded = Of(CareType.Periodic).Succeed(CareOutcome.NotRated);
        var failed = Of(CareType.Periodic).Fail("Không nghe máy");

        succeeded.MarkZaloSent(At, Guid.NewGuid()).ShouldBeFalse();
        failed.MarkZaloSent(At, Guid.NewGuid()).ShouldBeFalse();

        succeeded.Status.ShouldBe(CareStatus.Succeeded);
        failed.Status.ShouldBe(CareStatus.Failed);
        succeeded.ZaloSentAt.ShouldBe(At);
    }

    [Fact]
    public void A_Cancelled_Task_Stays_Cancelled_And_Still_Shows_The_Send()
    {
        var record = Of(CareType.AppointmentReminder).Cancel("Khách huỷ hẹn");

        record.MarkZaloSent(At, Guid.NewGuid()).ShouldBeFalse();

        record.Status.ShouldBe(CareStatus.Cancelled);
        record.CareStaffId.ShouldBeNull();
        record.ZaloSentAt.ShouldBe(At);
    }

    [Fact]
    public void Set_Back_By_Hand_After_A_Send_Keeps_The_Send_Mark()
    {
        var record = Of(CareType.AppointmentReminder);
        record.MarkZaloSent(At, Guid.NewGuid());

        record.SetContacted(false, At.AddHours(1), Guid.NewGuid()).ShouldBeTrue();

        record.Status.ShouldBe(CareStatus.New);
        record.ZaloSentAt.ShouldBe(At);
    }
}
