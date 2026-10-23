using System;
using BlueDental.Tools;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Tools;

/// <summary>
/// Chiến dịch đã gửi ▸ Kết quả lần gửi (BA P2210, F-79): a customer left out
/// of a send is kept as a row with the reason, and only a merged one names
/// the message it went into.
/// </summary>
public class MessageLogSkipTests
{
    private static readonly Guid Branch = Guid.NewGuid();

    [Fact]
    public void A_Skipped_Customer_Is_Kept_With_Its_Reason_And_Nothing_To_Send()
    {
        var log = MessageLog.Skip(Guid.NewGuid(), Branch, Guid.NewGuid(), Guid.NewGuid(),
            "Khách Test", recipientPhone: null, MessageChannelType.Zalo, MessageSkipReason.NoContact);

        log.Status.ShouldBe(MessageSendStatus.Skipped);
        log.SkipReason.ShouldBe(MessageSkipReason.NoContact);
        log.MergedIntoMessageId.ShouldBeNull();
        log.RecipientPhone.ShouldBe(string.Empty);
        log.Content.ShouldBe(string.Empty);
        log.SentAt.ShouldBeNull();
        MessageSendStatuses.Messages.ShouldNotContain(log.Status);
    }

    [Fact]
    public void A_Merged_Customer_Names_The_Message_That_Went_To_The_Shared_Phone()
    {
        var kept = Guid.NewGuid();

        var log = MessageLog.Skip(Guid.NewGuid(), Branch, Guid.NewGuid(), Guid.NewGuid(),
            "Khách Test", "84912345678", MessageChannelType.Zalo, MessageSkipReason.MergedPhone, kept);

        log.SkipReason.ShouldBe(MessageSkipReason.MergedPhone);
        log.MergedIntoMessageId.ShouldBe(kept);
        log.RecipientPhone.ShouldBe("84912345678");
    }

    [Fact]
    public void Only_A_Merged_Customer_Names_A_Message()
    {
        Should.Throw<ArgumentException>(() => MessageLog.Skip(Guid.NewGuid(), Branch, null, null,
            "Khách Test", "84912345678", MessageChannelType.Zalo, MessageSkipReason.MergedPhone));
        Should.Throw<ArgumentException>(() => MessageLog.Skip(Guid.NewGuid(), Branch, null, null,
            "Khách Test", "0123", MessageChannelType.Zalo, MessageSkipReason.InvalidPhone, Guid.NewGuid()));
    }

    [Fact]
    public void Stopped_And_Skipped_Rows_Are_Not_Messages()
    {
        MessageSendStatuses.Messages.ShouldBe(
            [MessageSendStatus.Pending, MessageSendStatus.Sent, MessageSendStatus.Failed, MessageSendStatus.Delivered],
            ignoreOrder: true);
    }
}
