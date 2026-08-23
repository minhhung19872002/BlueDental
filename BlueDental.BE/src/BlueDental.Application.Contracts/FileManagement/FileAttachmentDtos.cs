using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.FileManagement;

public class FileAttachmentDto : AuditedEntityDto<Guid>
{
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long FileSizeBytes { get; set; }
    public string BlobName { get; set; } = default!;
    public string? Description { get; set; }
    public string OwnerEntityType { get; set; } = default!;
    public Guid OwnerEntityId { get; set; }
    public Guid? UploadedBy { get; set; }
}

public class CreateFileAttachmentDto
{
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long FileSizeBytes { get; set; }
    public string BlobName { get; set; } = default!;
    public string OwnerEntityType { get; set; } = default!;
    public Guid OwnerEntityId { get; set; }
    public string? Description { get; set; }
}

public class GetFileAttachmentListInput : PagedAndSortedResultRequestDto
{
    public string? OwnerEntityType { get; set; }
    public Guid? OwnerEntityId { get; set; }
    public string? Filter { get; set; }
}
