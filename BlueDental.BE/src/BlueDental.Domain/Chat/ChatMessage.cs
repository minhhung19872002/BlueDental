using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Chat;

/// <summary>
/// One message of Chat nội bộ (F-89). Kept forever: a recall hides the text
/// and the files from everyone — the thread shows "Tin nhắn đã được thu hồi" —
/// but the row stays for the audit trail.
///
/// The text is stored encrypted (<see cref="IChatCipher"/>, bound to this
/// message's id); the rules on it are checked on the plain text first.
/// </summary>
public class ChatMessage : CreationAuditedAggregateRoot<Guid>
{
    public Guid ConversationId { get; private set; }

    public Guid SenderId { get; private set; }

    /// <summary>The encrypted text; null for a message that is only files.</summary>
    public string? ContentCipher { get; private set; }

    public int AttachmentCount { get; private set; }

    public DateTime SentAt { get; private set; }

    public DateTime? EditedAt { get; private set; }

    public DateTime? RecalledAt { get; private set; }

    public bool IsRecalled => RecalledAt.HasValue;

    protected ChatMessage() { }

    public static ChatMessage Send(
        Guid id, Guid conversationId, Guid senderId, string? content, int attachmentCount, DateTime now, IChatCipher cipher)
    {
        if (attachmentCount > ChatConsts.MaxAttachmentsPerMessage)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.TooManyAttachments)
                .WithData("max", ChatConsts.MaxAttachmentsPerMessage);
        }

        var plain = NormalizeContent(content, attachmentCount);
        return new ChatMessage
        {
            Id = id,
            ConversationId = conversationId,
            SenderId = senderId,
            ContentCipher = plain is null ? null : cipher.EncryptText(plain, id),
            AttachmentCount = attachmentCount,
            SentAt = now,
        };
    }

    /// <summary>The plain text, or null when there is none to show (files only, or recalled).</summary>
    public string? ReadContent(IChatCipher cipher) =>
        IsRecalled || ContentCipher is null ? null : cipher.DecryptText(ContentCipher, Id);

    public void Edit(Guid actorId, string? content, DateTime now, IChatCipher cipher)
    {
        EnsureSentBy(actorId);
        EnsureNotRecalled();

        var plain = NormalizeContent(content, AttachmentCount);
        if (plain == ReadContent(cipher))
        {
            return;
        }

        ContentCipher = plain is null ? null : cipher.EncryptText(plain, Id);
        EditedAt = now;
    }

    public void Recall(Guid actorId, DateTime now)
    {
        EnsureSentBy(actorId);
        EnsureNotRecalled();
        RecalledAt = now;
    }

    public void EnsureSentBy(Guid userId)
    {
        if (SenderId != userId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.NotSender);
        }
    }

    private void EnsureNotRecalled()
    {
        if (IsRecalled)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.MessageRecalled);
        }
    }

    /// <summary>Text may be left out only when files carry the message.</summary>
    private static string? NormalizeContent(string? content, int attachmentCount)
    {
        var trimmed = content?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return attachmentCount > 0
                ? null
                : throw new BusinessException(BlueDentalDomainErrorCodes.Chat.ContentRequired);
        }

        if (trimmed.Length > ChatConsts.MaxMessageLength)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.ContentTooLong)
                .WithData("max", ChatConsts.MaxMessageLength);
        }

        return trimmed;
    }
}
