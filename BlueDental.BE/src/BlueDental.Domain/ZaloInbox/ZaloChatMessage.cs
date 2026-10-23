using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.ZaloInbox;

/// <summary>
/// One message of a <see cref="ZaloConversation"/>, from the webhook, from a
/// history sync or sent from Hộp thư Zalo. Zalo's <c>msg_id</c> / <c>message_id</c>
/// is the key that keeps a message arriving twice (webhook then sync, or the
/// <c>oa_send_*</c> echo of our own send) from being stored twice.
/// </summary>
public class ZaloChatMessage : CreationAuditedEntity<Guid>
{
    public const int MaxZaloMessageIdLength = 100;
    public const int MaxTextLength = ZaloInboxConsts.MaxMessageLength;
    public const int MaxUrlLength = 1000;

    public Guid ClinicBranchId { get; private set; }

    public Guid ConversationId { get; private set; }

    public string? ZaloMessageId { get; private set; }

    public ZaloChatDirection Direction { get; private set; }

    public ZaloChatKind Kind { get; private set; }

    public string Text { get; private set; } = string.Empty;

    /// <summary>The image, sticker, file, link… a non-text message points at.</summary>
    public string? AttachmentUrl { get; private set; }

    public DateTime SentAt { get; private set; }

    /// <summary>Who answered from Hộp thư Zalo; null for the customer and for Zalo's own OA chat.</summary>
    public Guid? SenderUserId { get; private set; }

    protected ZaloChatMessage() { }

    public ZaloChatMessage(
        Guid id,
        ZaloConversation conversation,
        string? zaloMessageId,
        ZaloChatDirection direction,
        ZaloChatKind kind,
        string? text,
        string? attachmentUrl,
        DateTime sentAt,
        Guid? senderUserId)
        : base(id)
    {
        Check.NotNull(conversation, nameof(conversation));
        ClinicBranchId = conversation.ClinicBranchId;
        ConversationId = conversation.Id;
        ZaloMessageId = Clip(string.IsNullOrWhiteSpace(zaloMessageId) ? null : zaloMessageId.Trim(), MaxZaloMessageIdLength);
        Direction = direction;
        Kind = kind;
        Text = Clip(text?.Trim(), MaxTextLength) ?? string.Empty;
        AttachmentUrl = Clip(string.IsNullOrWhiteSpace(attachmentUrl) ? null : attachmentUrl.Trim(), MaxUrlLength);
        SentAt = sentAt;
        SenderUserId = direction == ZaloChatDirection.Outbound ? senderUserId : null;
    }

    /// <summary>An OA message first stored from Zalo's echo turns out to be a Hộp thư Zalo reply.</summary>
    public void AttributeTo(Guid senderUserId)
    {
        if (Direction == ZaloChatDirection.Outbound)
        {
            SenderUserId ??= senderUserId;
        }
    }

    /// <summary>The list's one-line preview: the text, or what kind of thing was sent.</summary>
    public string Preview => Text.Length > 0 ? Text : $"[{Kind}]";

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}
