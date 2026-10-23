using System;
using System.Collections.Generic;
using BlueDental.CustomerCare;
using BlueDental.Tools;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Tools;

/// <summary>
/// CSKH ▸ Gửi tin nhắn (BA P2110, F-77): a send takes a "Sẵn sàng" template of
/// its own branch, a CSKH tab or picked customers, at least one customer, and
/// a time still ahead when it is scheduled; it can be called off only before
/// the sender has taken it.
/// </summary>
public class MessageSendBatchTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 10, 22, 3, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc);

    private static MessageTemplate ReadyZalo(Guid? branch = null) =>
        MessageTemplate.CreatePublished(Guid.NewGuid(), branch ?? Branch, MessageChannelType.Zalo,
            new MessageTemplateContent("Nhắc lịch ZNS", CareType.AppointmentReminder, Content: null, Subject: null,
                "301001", new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}" },
                RemoveDiacritics: false),
            ["customer_name"], "ENABLE");

    private static MessageSendRecipients List(CareType? type = CareType.AppointmentReminder, int count = 3, int skipped = 1) =>
        new(MessageRecipientSource.CareList, type, From, To, count, skipped);

    private static MessageSendBatch Create(
        MessageTemplate? template = null, MessageSendRecipients? recipients = null, DateTime? scheduledAt = null) =>
        MessageSendBatch.Create(Guid.NewGuid(), Branch, template ?? ReadyZalo(), recipients ?? List(),
            skipRecentDuplicates: true, scheduledAt, Now);

    private static void ShouldRefuse(Action act, string code) =>
        Should.Throw<BusinessException>(act).Code.ShouldBe(code);

    [Fact]
    public void A_Send_To_A_Care_List_Is_Queued_With_Its_Tab_And_Period()
    {
        var template = ReadyZalo();

        var batch = Create(template);

        batch.Status.ShouldBe(MessageSendBatchStatus.Queued);
        batch.Channel.ShouldBe(MessageChannelType.Zalo);
        batch.TemplateId.ShouldBe(template.Id);
        batch.TemplateName.ShouldBe("Nhắc lịch ZNS");
        batch.CareType.ShouldBe(CareType.AppointmentReminder);
        batch.FromDate.ShouldBe(From);
        batch.ToDate.ShouldBe(To);
        batch.RecipientCount.ShouldBe(3);
        batch.SkippedCount.ShouldBe(1);
        batch.SkipRecentDuplicates.ShouldBeTrue();
        batch.IsDue(Now).ShouldBeTrue();
    }

    [Fact]
    public void Picked_Customers_Keep_No_Tab_Or_Period()
    {
        var batch = Create(recipients: new MessageSendRecipients(
            MessageRecipientSource.Individual, CareType.Birthday, From, To, Count: 1, Skipped: 0));

        batch.Source.ShouldBe(MessageRecipientSource.Individual);
        batch.CareType.ShouldBeNull();
        batch.FromDate.ShouldBeNull();
        batch.ToDate.ShouldBeNull();
    }

    [Fact]
    public void Only_A_Ready_Template_Of_The_Branch_Can_Be_Sent()
    {
        var draft = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Zalo,
            new MessageTemplateContent("Nháp", null, null, null, null, null, false));
        var pending = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Zalo,
            new MessageTemplateContent("Chờ duyệt", CareType.Birthday, null, null, "301002",
                new Dictionary<string, string>(), false), [], "PENDING_REVIEW");
        var switchedOff = ReadyZalo();
        switchedOff.SetActive(false);

        ShouldRefuse(() => Create(draft), BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        ShouldRefuse(() => Create(pending), BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        ShouldRefuse(() => Create(switchedOff), BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        ShouldRefuse(() => Create(ReadyZalo(Guid.NewGuid())), BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
    }

    [Fact]
    public void A_Zalo_Template_Of_The_Older_Tools_Screen_Has_No_Zns_Link_And_Cannot_Be_Sent()
    {
        var legacy = new MessageTemplate(Guid.NewGuid(), Branch, "Cũ", "Chào {ten_khach_hang}", MessageChannelType.Zalo, null);

        legacy.Status.ShouldBe(MessageTemplateStatus.Ready);
        legacy.CanSend.ShouldBeFalse();
        ShouldRefuse(() => Create(legacy), BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(CareType.Base)]
    public void A_Care_List_Send_Needs_One_Of_The_Ten_Tabs(CareType? type)
    {
        ShouldRefuse(() => Create(recipients: List(type)), BlueDentalDomainErrorCodes.Tools.SendListRequired);
    }

    [Fact]
    public void A_Send_Needs_Someone_To_Send_To()
    {
        ShouldRefuse(() => Create(recipients: List(count: 0, skipped: 4)), BlueDentalDomainErrorCodes.Tools.SendNoRecipients);
    }

    [Fact]
    public void A_Scheduled_Time_Must_Still_Be_Ahead()
    {
        ShouldRefuse(() => Create(scheduledAt: Now), BlueDentalDomainErrorCodes.Tools.SendScheduleInPast);
        ShouldRefuse(() => Create(scheduledAt: Now.AddMinutes(-5)), BlueDentalDomainErrorCodes.Tools.SendScheduleInPast);

        var batch = Create(scheduledAt: Now.AddHours(2));

        batch.ScheduledAt.ShouldBe(Now.AddHours(2));
        batch.IsDue(Now).ShouldBeFalse();
        batch.IsDue(Now.AddHours(2)).ShouldBeTrue();
    }

    [Fact]
    public void The_Sender_Takes_A_Due_Batch_And_Takes_It_Again_After_A_Stop()
    {
        var batch = Create(scheduledAt: Now.AddHours(1));

        batch.TryStart(Now).ShouldBeFalse();
        batch.Status.ShouldBe(MessageSendBatchStatus.Queued);

        batch.TryStart(Now.AddHours(1)).ShouldBeTrue();
        batch.Status.ShouldBe(MessageSendBatchStatus.Sending);
        batch.StartedAt.ShouldBe(Now.AddHours(1));

        batch.TryStart(Now.AddHours(2)).ShouldBeTrue();
        batch.StartedAt.ShouldBe(Now.AddHours(1));

        batch.Complete(Now.AddHours(3));
        batch.Status.ShouldBe(MessageSendBatchStatus.Completed);
        batch.CompletedAt.ShouldBe(Now.AddHours(3));
        batch.TryStart(Now.AddHours(4)).ShouldBeFalse();
    }

    [Fact]
    public void Only_A_Batch_Still_Waiting_Can_Be_Called_Off()
    {
        var waiting = Create(scheduledAt: Now.AddHours(1));
        waiting.Cancel(Now);

        waiting.Status.ShouldBe(MessageSendBatchStatus.Cancelled);
        waiting.CancelledAt.ShouldBe(Now);
        waiting.TryStart(Now.AddHours(1)).ShouldBeFalse();

        var sending = Create();
        sending.TryStart(Now);
        ShouldRefuse(() => sending.Cancel(Now), BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
    }

    [Fact]
    public void Stopping_A_Batch_Still_Waiting_Calls_It_Off()
    {
        var waiting = Create(scheduledAt: Now.AddHours(1));

        waiting.Stop(Now);

        waiting.Status.ShouldBe(MessageSendBatchStatus.Cancelled);
        waiting.CancelledAt.ShouldBe(Now);
        waiting.IsCalledOff.ShouldBeTrue();
        waiting.TryStart(Now.AddHours(1)).ShouldBeFalse();
    }

    [Fact]
    public void Stopping_A_Batch_That_Is_Sending_Ends_It_For_Good()
    {
        var batch = Create();
        batch.TryStart(Now);

        batch.Stop(Now.AddMinutes(2));

        batch.Status.ShouldBe(MessageSendBatchStatus.Stopped);
        batch.CancelledAt.ShouldBe(Now.AddMinutes(2));
        batch.IsCalledOff.ShouldBeTrue();
        batch.TryStart(Now.AddMinutes(3)).ShouldBeFalse();

        batch.Complete(Now.AddMinutes(4));
        batch.Status.ShouldBe(MessageSendBatchStatus.Stopped);
        batch.CompletedAt.ShouldBeNull();
    }

    [Fact]
    public void A_Batch_That_Ended_Cannot_Be_Stopped()
    {
        var completed = Create();
        completed.TryStart(Now);
        completed.Complete(Now);
        var cancelled = Create(scheduledAt: Now.AddHours(1));
        cancelled.Cancel(Now);
        var stopped = Create();
        stopped.TryStart(Now);
        stopped.Stop(Now);

        ShouldRefuse(() => completed.Stop(Now), BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        ShouldRefuse(() => cancelled.Stop(Now), BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        ShouldRefuse(() => stopped.Stop(Now), BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        ShouldRefuse(() => stopped.Cancel(Now), BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        completed.IsCalledOff.ShouldBeFalse();
    }

    [Fact]
    public void Completing_A_Batch_Nobody_Took_Changes_Nothing()
    {
        var batch = Create();

        batch.Complete(Now);

        batch.Status.ShouldBe(MessageSendBatchStatus.Queued);
        batch.CompletedAt.ShouldBeNull();
    }
}
