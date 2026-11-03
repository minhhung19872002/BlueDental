using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Billing;

/// <summary>
/// The signature "Ký điện tử" puts on every PHIẾU THU an accountant exports
/// (P2910_02): one per user, AES-GCM sealed like the customer's, replaced by
/// "Ký lại" or "Tải ảnh lên". Every change is also written to
/// <see cref="AccountantSignatureChange"/>.
/// </summary>
public class AccountantSignature : AggregateRoot<Guid>
{
    public Guid UserId { get; private set; }

    /// <summary>The PNG, sealed by <see cref="IReceiptCipher"/>.</summary>
    public string SignatureCipher { get; private set; } = string.Empty;

    public AccountantSignatureSource Source { get; private set; }

    /// <summary>When this signature was saved — what the receipt keeps as the signer's timestamp.</summary>
    public DateTimeOffset SavedAt { get; private set; }

    protected AccountantSignature() { }

    public static AccountantSignature Save(
        Guid id, Guid userId, string signatureCipher, AccountantSignatureSource source, DateTimeOffset savedAt) =>
        new()
        {
            Id = id,
            UserId = userId,
            SignatureCipher = Check.NotNullOrWhiteSpace(signatureCipher, nameof(signatureCipher)),
            Source = source,
            SavedAt = savedAt
        };

    /// <summary>"Ký lại" / "Tải ảnh lên": the new one takes the old one's place.</summary>
    public void Replace(string signatureCipher, AccountantSignatureSource source, DateTimeOffset savedAt)
    {
        SignatureCipher = Check.NotNullOrWhiteSpace(signatureCipher, nameof(signatureCipher));
        Source = source;
        SavedAt = savedAt;
    }

    public ReceiptSigner Signer => new(UserId, SavedAt);
}

/// <summary>
/// One line of the signature change log the BA asked for: who, when and how —
/// a time of its own, apart from any receipt's export time.
/// </summary>
public class AccountantSignatureChange : Entity<Guid>
{
    public Guid UserId { get; private set; }
    public AccountantSignatureSource Source { get; private set; }
    public DateTimeOffset ChangedAt { get; private set; }

    protected AccountantSignatureChange() { }

    public AccountantSignatureChange(Guid id, Guid userId, AccountantSignatureSource source, DateTimeOffset changedAt)
        : base(id)
    {
        UserId = userId;
        Source = source;
        ChangedAt = changedAt;
    }
}
