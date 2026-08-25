using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// Phương thức thanh toán — a MoMo wallet or a bank account the clinic collects
/// into.
///
/// Reference: /taxonomy/payment-method, two tabs over one list. MoMo rows carry
/// a phone number; bank rows carry a bank name and an account number. Both
/// always carry the account holder.
/// </summary>
public class PaymentAccount : FullAuditedAggregateRoot<Guid>
{
    /// <summary>
    /// A QR code is a small square image; anything larger than this is a photo
    /// pasted in by mistake and is refused before it reaches object storage.
    /// </summary>
    public const long MaxQrImageBytes = 5 * 1024 * 1024;

    public Guid ClinicBranchId { get; private set; }
    public PaymentAccountKind Kind { get; private set; }
    public string HolderName { get; private set; } = default!;

    /// <summary>Set on MoMo accounts only.</summary>
    public string? PhoneNumber { get; private set; }

    /// <summary>Set on bank accounts only.</summary>
    public string? BankName { get; private set; }

    /// <summary>Set on bank accounts only.</summary>
    public string? AccountNumber { get; private set; }

    public bool IsActive { get; private set; }

    /// <summary>
    /// Name of the QR image blob in object storage, or null when the account has
    /// no QR yet. The bytes never live in PostgreSQL — same rule as patient
    /// images.
    /// </summary>
    public string? QrImageBlobName { get; private set; }

    /// <summary>Original file name, shown next to the preview.</summary>
    public string? QrImageFileName { get; private set; }

    public string? QrImageContentType { get; private set; }

    public long QrImageSizeBytes { get; private set; }

    public bool HasQrImage => QrImageBlobName != null;

    protected PaymentAccount() { }

    public static PaymentAccount CreateMoMo(
        Guid id,
        Guid clinicBranchId,
        string phoneNumber,
        string holderName)
    {
        Check.NotNullOrWhiteSpace(phoneNumber, nameof(phoneNumber));
        Check.NotNullOrWhiteSpace(holderName, nameof(holderName));

        return new PaymentAccount
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Kind = PaymentAccountKind.MoMo,
            PhoneNumber = phoneNumber,
            HolderName = holderName,
            IsActive = true
        };
    }

    public static PaymentAccount CreateBank(
        Guid id,
        Guid clinicBranchId,
        string bankName,
        string holderName,
        string accountNumber)
    {
        Check.NotNullOrWhiteSpace(bankName, nameof(bankName));
        Check.NotNullOrWhiteSpace(holderName, nameof(holderName));
        Check.NotNullOrWhiteSpace(accountNumber, nameof(accountNumber));

        return new PaymentAccount
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Kind = PaymentAccountKind.Bank,
            BankName = bankName,
            HolderName = holderName,
            AccountNumber = accountNumber,
            IsActive = true
        };
    }

    /// <summary>
    /// The kind is fixed at creation: a MoMo wallet and a bank account do not
    /// hold the same fields, so switching one into the other would leave the
    /// row half-filled. Delete and re-add instead.
    /// </summary>
    public void Update(string holderName, string? phoneNumber, string? bankName, string? accountNumber)
    {
        Check.NotNullOrWhiteSpace(holderName, nameof(holderName));
        HolderName = holderName;

        if (Kind == PaymentAccountKind.MoMo)
        {
            Check.NotNullOrWhiteSpace(phoneNumber, nameof(phoneNumber));
            PhoneNumber = phoneNumber;
            return;
        }

        Check.NotNullOrWhiteSpace(bankName, nameof(bankName));
        Check.NotNullOrWhiteSpace(accountNumber, nameof(accountNumber));
        BankName = bankName;
        AccountNumber = accountNumber;
    }

    /// <summary>
    /// Points the account at a freshly stored QR image and returns the blob the
    /// caller must now delete — replacing a QR leaves the old bytes orphaned in
    /// object storage otherwise.
    /// </summary>
    public string? AttachQrImage(string blobName, string fileName, string contentType, long sizeBytes)
    {
        Check.NotNullOrWhiteSpace(blobName, nameof(blobName));
        Check.NotNullOrWhiteSpace(fileName, nameof(fileName));

        if (sizeBytes <= 0 || sizeBytes > MaxQrImageBytes)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidQrImageFile,
                $"A QR image must be between 1 byte and {MaxQrImageBytes / (1024 * 1024)} MB.");
        }

        if (!IsSupportedQrImage(contentType))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.UnsupportedQrImageType,
                $"'{contentType}' is not a supported QR image type.");
        }

        var replaced = QrImageBlobName;

        QrImageBlobName = blobName;
        QrImageFileName = fileName;
        QrImageContentType = contentType;
        QrImageSizeBytes = sizeBytes;

        return replaced == blobName ? null : replaced;
    }

    /// <summary>Drops the QR and returns the blob the caller must delete.</summary>
    public string? ClearQrImage()
    {
        var removed = QrImageBlobName;

        QrImageBlobName = null;
        QrImageFileName = null;
        QrImageContentType = null;
        QrImageSizeBytes = 0;

        return removed;
    }

    /// <summary>
    /// A QR is a still image the receptionist shows on screen, so the raster
    /// formats a phone camera reads are enough; nothing else is stored.
    /// </summary>
    public static bool IsSupportedQrImage(string? contentType) =>
        contentType?.ToLowerInvariant() switch
        {
            "image/jpeg" or "image/jpg" or "image/png" or "image/webp" => true,
            _ => false
        };

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
