using BlueDental.ZaloInbox;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.ZaloInbox;

/// <summary>Zalo's webhook event names and history types, read as direction and kind.</summary>
public class ZaloChatKindsTests
{
    [Theory]
    [InlineData("user_send_text", ZaloChatDirection.Inbound, ZaloChatKind.Text)]
    [InlineData("user_send_image", ZaloChatDirection.Inbound, ZaloChatKind.Image)]
    [InlineData("user_send_gif", ZaloChatDirection.Inbound, ZaloChatKind.Image)]
    [InlineData("user_send_sticker", ZaloChatDirection.Inbound, ZaloChatKind.Sticker)]
    [InlineData("user_send_file", ZaloChatDirection.Inbound, ZaloChatKind.File)]
    [InlineData("user_send_location", ZaloChatDirection.Inbound, ZaloChatKind.Location)]
    [InlineData("user_send_business_card", ZaloChatDirection.Inbound, ZaloChatKind.Other)]
    [InlineData("oa_send_text", ZaloChatDirection.Outbound, ZaloChatKind.Text)]
    [InlineData("oa_send_list", ZaloChatDirection.Outbound, ZaloChatKind.Other)]
    public void Chat_Events_Give_Direction_And_Kind(string eventName, ZaloChatDirection direction, ZaloChatKind kind)
    {
        ZaloChatKinds.OfEvent(eventName).ShouldBe((direction, kind));
    }

    [Theory]
    [InlineData("user_received_message")]
    [InlineData("user_seen_message")]
    [InlineData("follow")]
    [InlineData(null)]
    public void Other_Events_Are_Not_Chat(string? eventName)
    {
        ZaloChatKinds.OfEvent(eventName).ShouldBeNull();
    }

    [Theory]
    [InlineData("text", ZaloChatKind.Text)]
    [InlineData("photo", ZaloChatKind.Image)]
    [InlineData("GIF", ZaloChatKind.Image)]
    [InlineData("voice", ZaloChatKind.Audio)]
    [InlineData("links", ZaloChatKind.Link)]
    [InlineData("sticker", ZaloChatKind.Sticker)]
    [InlineData("nudge", ZaloChatKind.Other)]
    public void History_Types_Give_The_Kind(string type, ZaloChatKind kind)
    {
        ZaloChatKinds.OfHistoryType(type).ShouldBe(kind);
    }
}
