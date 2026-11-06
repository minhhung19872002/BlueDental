using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Chat;

/// <summary>
/// A wording of a chat message that an edit replaced (F-89 / R-1159, owner
/// 2026-11-06: keep every earlier version, the members may read them). Created
/// only by <see cref="ChatMessage.Edit"/>, never changed afterwards.
///
/// Its text is encrypted like the message's, but bound to this revision's own
/// id: a ciphertext moved onto another revision or message fails to open.
/// </summary>
public class ChatMessageRevision : Entity<Guid>
{
    public Guid MessageId { get; private set; }

    public Guid ClinicBranchId { get; private set; }

    /// <summary>The encrypted text that was replaced; null when the message had only files then.</summary>
    public string? ContentCipher { get; private set; }

    /// <summary>The patients tagged in this wording (R-1161), in order.</summary>
    public List<Guid> PatientIds { get; private set; } = [];

    /// <summary>When this wording was replaced by the next one.</summary>
    public DateTime EditedAt { get; private set; }

    protected ChatMessageRevision() { }

    internal ChatMessageRevision(
        Guid id,
        Guid messageId,
        Guid clinicBranchId,
        string? replacedText,
        IEnumerable<Guid> patientIds,
        DateTime editedAt,
        IChatCipher cipher)
        : base(id)
    {
        MessageId = messageId;
        ClinicBranchId = clinicBranchId;
        ContentCipher = replacedText is null ? null : cipher.EncryptText(replacedText, id);
        PatientIds = patientIds.ToList();
        EditedAt = editedAt;
    }

    public string? ReadContent(IChatCipher cipher) =>
        ContentCipher is null ? null : cipher.DecryptText(ContentCipher, Id);
}
