using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.FileManagement;

/// <summary>
/// An image dropped into a rich-text body — an article, a piece of consulting
/// data, a diagnosis.
///
/// The editor writes HTML, and left alone it embeds a pasted image as a base64
/// data URL inside that HTML. That puts the bytes in the row: a list endpoint
/// returns every body, so twenty rows with a photo each ship tens of megabytes
/// on every page load — and BlueDental does not keep binaries in PostgreSQL.
/// The bytes go to blob storage and the body carries a link.
///
/// Shared deliberately. This began life owned by Vận hành, while Danh mục went
/// on embedding its images; two editors that look identical behaved differently
/// and stored differently. One store, one endpoint, one set of limits.
/// </summary>
public class RichTextImage : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Every row here is one branch's, as everywhere else.</summary>
    public Guid ClinicBranchId { get; private set; }

    public string BlobName { get; private set; } = default!;
    public string FileName { get; private set; } = default!;
    public string ContentType { get; private set; } = default!;
    public long SizeInBytes { get; private set; }

    /// <summary>Kept in step with the client's own guard. 5 MB.</summary>
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly string[] Accepted =
        ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

    public static bool IsSupported(string contentType) =>
        Array.IndexOf(Accepted, contentType.ToLowerInvariant()) >= 0;

    protected RichTextImage() { }

    public RichTextImage(
        Guid id,
        Guid clinicBranchId,
        string blobName,
        string fileName,
        string contentType,
        long sizeInBytes) : base(id)
    {
        if (!IsSupported(contentType))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.FileManagement.UnsupportedImage,
                "Only PNG, JPG, WEBP or GIF images can be placed in a body.");
        }

        if (sizeInBytes <= 0 || sizeInBytes > MaxBytes)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.FileManagement.ImageTooLarge,
                "An image in a body must be smaller than 5 MB.");
        }

        ClinicBranchId = clinicBranchId;
        BlobName = blobName;
        FileName = fileName;
        ContentType = contentType;
        SizeInBytes = sizeInBytes;
    }
}
