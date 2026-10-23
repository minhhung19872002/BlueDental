using System;

namespace BlueDental.ZaloInbox;

/// <summary>Zalo's names for a kind of message, in the webhook and in the history APIs.</summary>
public static class ZaloChatKinds
{
    public const string UserEventPrefix = "user_send_";
    public const string OaEventPrefix = "oa_send_";

    /// <summary>
    /// The direction and kind of a chat webhook event, or null for any event
    /// that is not a message of the chat (follow, seen, ZNS delivery…).
    /// </summary>
    public static (ZaloChatDirection Direction, ZaloChatKind Kind)? OfEvent(string? eventName)
    {
        if (string.IsNullOrWhiteSpace(eventName))
        {
            return null;
        }

        if (eventName.StartsWith(UserEventPrefix, StringComparison.Ordinal))
        {
            return (ZaloChatDirection.Inbound, OfSuffix(eventName[UserEventPrefix.Length..]));
        }

        if (eventName.StartsWith(OaEventPrefix, StringComparison.Ordinal))
        {
            return (ZaloChatDirection.Outbound, OfSuffix(eventName[OaEventPrefix.Length..]));
        }

        return null;
    }

    /// <summary>The history APIs' <c>type</c>: text, photo, GIF, sticker, link, links, voice, location, file.</summary>
    public static ZaloChatKind OfHistoryType(string? type) => (type ?? string.Empty).ToLowerInvariant() switch
    {
        "text" => ZaloChatKind.Text,
        "photo" or "image" or "gif" => ZaloChatKind.Image,
        "voice" or "audio" => ZaloChatKind.Audio,
        _ => OfSuffix(type),
    };

    private static ZaloChatKind OfSuffix(string? suffix) => (suffix ?? string.Empty).ToLowerInvariant() switch
    {
        "text" => ZaloChatKind.Text,
        "image" or "gif" => ZaloChatKind.Image,
        "sticker" => ZaloChatKind.Sticker,
        "file" => ZaloChatKind.File,
        "link" or "links" => ZaloChatKind.Link,
        "audio" => ZaloChatKind.Audio,
        "video" => ZaloChatKind.Video,
        "location" => ZaloChatKind.Location,
        _ => ZaloChatKind.Other,
    };
}
