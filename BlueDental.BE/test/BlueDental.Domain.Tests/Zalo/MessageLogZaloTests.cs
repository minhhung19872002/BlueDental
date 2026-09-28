using System;
using BlueDental.Tools;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class MessageLogZaloTests
{
    private static readonly DateTime Now = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);

    private static MessageLog Pending() => new(
        Guid.NewGuid(), Guid.NewGuid(), null, null, "Nguyen Test", "84912345678",
        "Template | a=b", MessageChannelType.Zalo, MessageSendStatus.Pending, null, null);

    [Fact]
    public void Mark_sent_stores_the_provider_id_cost_and_time()
    {
        var log = Pending().SetExternalTemplate("123456").MarkSent("msg-1", Now, 550m);

        log.Status.ShouldBe(MessageSendStatus.Sent);
        log.ExternalMessageId.ShouldBe("msg-1");
        log.ExternalTemplateId.ShouldBe("123456");
        log.Cost.ShouldBe(550m);
        log.SentAt.ShouldBe(Now);
        log.ErrorMessage.ShouldBeNull();
    }

    [Fact]
    public void Mark_failed_keeps_the_provider_message_clipped()
    {
        var log = Pending().MarkFailed(new string('e', 800));

        log.Status.ShouldBe(MessageSendStatus.Failed);
        log.ErrorMessage!.Length.ShouldBe(MessageLog.MaxErrorLength);
    }

    [Fact]
    public void Only_a_sent_message_becomes_delivered()
    {
        var sent = Pending().MarkSent("msg-1", Now, null).MarkDelivered(Now.AddMinutes(1));
        var failed = Pending().MarkFailed("no").MarkDelivered(Now);

        sent.Status.ShouldBe(MessageSendStatus.Delivered);
        failed.Status.ShouldBe(MessageSendStatus.Failed);
    }
}
