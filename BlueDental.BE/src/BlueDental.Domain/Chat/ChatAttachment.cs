using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Chat;

/// <summary>
/// A file sent in Chat nội bộ (F-89). It is uploaded first, one file per
/// request, and joins a message when that message is sent; until then only
/// its uploader can use it and nobody can read it.
///
/// Both the file (in blob storage) and its name (here) are encrypted with
/// <see cref="IChatCipher"/>, bound to this attachment's id.
/// </summary>
public class ChatAttachment : CreationAuditedAggregateRoot<Guid>
{
    public Guid ConversationId { get; private set; }

    public Guid UploaderId { get; private set; }

    /// <summary>Null while the file waits for its message.</summary>
    public Guid? MessageId { get; private set; }

    public string BlobName { get; private set; } = default!;

    public string FileNameCipher { get; private set; } = default!;

    public string ContentType { get; private set; } = default!;

    /// <summary>Size of the original file, not of the sealed blob.</summary>
    public long SizeInBytes { get; private set; }

    protected ChatAttachment() { }

    public static ChatAttachment Upload(
        Guid id,
        Guid conversationId,
        Guid uploaderId,
        string blobName,
        string fileName,
        string contentType,
        long sizeInBytes,
        IChatCipher cipher)
    {
        return new ChatAttachment
        {
            Id = id,
            ConversationId = conversationId,
            UploaderId = uploaderId,
            BlobName = blobName,
            FileNameCipher = cipher.EncryptText(fileName, id),
            ContentType = contentType,
            SizeInBytes = sizeInBytes,
        };
    }

    public string ReadFileName(IChatCipher cipher) => cipher.DecryptText(FileNameCipher, Id);

    public void AttachTo(Guid messageId, Guid conversationId, Guid senderId)
    {
        if (MessageId is not null || ConversationId != conversationId || UploaderId != senderId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.AttachmentUnavailable);
        }

        MessageId = messageId;
    }
}
