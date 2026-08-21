using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.FileManagement;

/// <summary>
/// Aggregate root for file attachments (X-rays, documents, consent forms) linked to
/// patients, appointments, or treatment records.
/// </summary>
public class FileAttachment : AuditedAggregateRoot<Guid>
{
    public string FileName { get; private set; } = default!;
    public string ContentType { get; private set; } = default!;
    public long FileSizeBytes { get; private set; }
    public string BlobName { get; private set; } = default!;
    public string? Description { get; private set; }
    public string OwnerEntityType { get; private set; } = default!;
    public Guid OwnerEntityId { get; private set; }
    public Guid? UploadedBy { get; private set; }

    protected FileAttachment() { }

    public FileAttachment(
        Guid id,
        string fileName,
        string contentType,
        long fileSizeBytes,
        string blobName,
        string ownerEntityType,
        Guid ownerEntityId,
        Guid? uploadedBy = null,
        string? description = null)
        : base(id)
    {
        FileName = fileName;
        ContentType = contentType;
        FileSizeBytes = fileSizeBytes;
        BlobName = blobName;
        OwnerEntityType = ownerEntityType;
        OwnerEntityId = ownerEntityId;
        UploadedBy = uploadedBy;
        Description = description;
    }

    public FileAttachment UpdateDescription(string? description)
    {
        Description = description;
        return this;
    }
}
