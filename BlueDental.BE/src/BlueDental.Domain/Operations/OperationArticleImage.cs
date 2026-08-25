using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

/// <summary>
/// An image dropped into an article's body.
///
/// The editor writes HTML, and left alone it embeds a pasted image as a base64
/// data URL inside that HTML. That put the bytes in the row: the article list
/// returns every body, so twenty articles with a photo each would ship tens of
/// megabytes on every page load — and BlueDental does not keep binaries in
/// PostgreSQL. So the bytes go to blob storage and the body carries a link.
/// </summary>
public class OperationArticleImage : FullAuditedAggregateRoot<Guid>
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

    protected OperationArticleImage() { }

    public OperationArticleImage(
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
                BlueDentalDomainErrorCodes.Operations.UnsupportedImage,
                "Only PNG, JPG, WEBP or GIF images can be placed in an article.");
        }

        if (sizeInBytes <= 0 || sizeInBytes > MaxBytes)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Operations.ImageTooLarge,
                "An article image must be smaller than 5 MB.");
        }

        ClinicBranchId = clinicBranchId;
        BlobName = blobName;
        FileName = fileName;
        ContentType = contentType;
        SizeInBytes = sizeInBytes;
    }
}
