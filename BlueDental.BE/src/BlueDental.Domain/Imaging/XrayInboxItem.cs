using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Imaging;

/// <summary>
/// One file an X-ray PC sent (F-95), whatever became of it — the log of every
/// call the station received. A file whose code names a record of the device's
/// branch goes straight onto it; anything else waits here, as "Ảnh chưa gán hồ
/// sơ", for a staff member to put on a record or set aside. A name and birth
/// year read off the file are only ever a suggestion: nothing is put on a
/// record by name.
///
/// (device, SHA-256) is unique, so an agent re-sending a file after a lost
/// answer adds nothing.
/// </summary>
public class XrayInboxItem : CreationAuditedAggregateRoot<Guid>
{
    public const int MaxFileNameLength = 300;
    public const int MaxHintCodeLength = 50;
    public const int MaxHintNameLength = 200;

    public Guid ClinicBranchId { get; private set; }

    public Guid XrayDeviceId { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public string FileName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long SizeBytes { get; private set; }

    /// <summary>Lower-case hex SHA-256 of the bytes.</summary>
    public string Sha256 { get; private set; } = string.Empty;

    /// <summary>Mã hồ sơ the agent read off the file or folder name, as read.</summary>
    public string? HintCode { get; private set; }

    /// <summary>Patient name read off the file name — a suggestion only.</summary>
    public string? HintName { get; private set; }

    public int? HintBirthYear { get; private set; }

    /// <summary>When the file was written on the X-ray PC.</summary>
    public DateTimeOffset? CapturedAt { get; private set; }

    public DateTimeOffset ReceivedAt { get; private set; }

    public XrayInboxStatus Status { get; private set; }

    public Guid? PatientId { get; private set; }

    public Guid? PatientImageId { get; private set; }

    /// <summary>Who assigned or set it aside; null when it went to a record on arrival.</summary>
    public Guid? HandledBy { get; private set; }

    public DateTimeOffset? HandledAt { get; private set; }

    protected XrayInboxItem() { }

    public static XrayInboxItem Receive(
        Guid id,
        XrayDevice device,
        string blobName,
        string fileName,
        string contentType,
        long sizeBytes,
        string sha256,
        string? hintCode,
        string? hintName,
        int? hintBirthYear,
        DateTimeOffset? capturedAt,
        DateTimeOffset receivedAt)
    {
        Check.NotNullOrWhiteSpace(blobName, nameof(blobName));
        Check.NotNullOrWhiteSpace(contentType, nameof(contentType));
        Check.NotNullOrWhiteSpace(sha256, nameof(sha256));

        return new XrayInboxItem
        {
            Id = id,
            ClinicBranchId = device.ClinicBranchId,
            XrayDeviceId = device.Id,
            BlobName = blobName,
            FileName = Clip(string.IsNullOrWhiteSpace(fileName) ? "xray" : fileName.Trim(), MaxFileNameLength)!,
            ContentType = contentType,
            SizeBytes = sizeBytes,
            Sha256 = sha256,
            HintCode = Clip(hintCode, MaxHintCodeLength),
            HintName = Clip(hintName, MaxHintNameLength),
            HintBirthYear = hintBirthYear is >= 1900 and <= 2100 ? hintBirthYear : null,
            CapturedAt = capturedAt,
            ReceivedAt = receivedAt,
            Status = XrayInboxStatus.Pending,
        };
    }

    /// <summary>Its code named a record of the branch: put there on arrival, by nobody.</summary>
    public void MarkAutoAssigned(Guid patientId, Guid patientImageId, DateTimeOffset now)
    {
        EnsurePending();
        Status = XrayInboxStatus.AutoAssigned;
        PatientId = patientId;
        PatientImageId = patientImageId;
        HandledAt = now;
    }

    public void Assign(Guid patientId, Guid patientImageId, Guid staffId, DateTimeOffset now)
    {
        EnsurePending();
        Status = XrayInboxStatus.Assigned;
        PatientId = patientId;
        PatientImageId = patientImageId;
        HandledBy = staffId;
        HandledAt = now;
    }

    public void Discard(Guid staffId, DateTimeOffset now)
    {
        EnsurePending();
        Status = XrayInboxStatus.Discarded;
        HandledBy = staffId;
        HandledAt = now;
    }

    private void EnsurePending()
    {
        if (Status != XrayInboxStatus.Pending)
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.InboxItemHandled);
    }

    private static string? Clip(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return null;

        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }
}
