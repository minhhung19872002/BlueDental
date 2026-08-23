using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// A clinical image attached to a patient record (Hình ảnh).
///
/// The reference lists them per patient (<c>GET /patient-images</c>) and advises
/// reference them by <c>imageIds</c>, so an image is its own record rather than a
/// field on something else. Only the blob name is kept here — the bytes live in
/// object storage, never in PostgreSQL.
/// </summary>
public class PatientImage : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Bytes larger than this are refused before they reach storage.</summary>
    public const long MaxSizeBytes = 20 * 1024 * 1024;

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Treatment slip this image belongs to, when it was taken for one.</summary>
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>Công đoạn this image documents, when it was taken for one.</summary>
    public Guid? TreatmentStageId { get; private set; }

    /// <summary>Name of the blob in object storage.</summary>
    public string BlobName { get; private set; } = string.Empty;

    /// <summary>Original file name, shown to the user.</summary>
    public string FileName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long SizeBytes { get; private set; }

    public string? Note { get; private set; }

    /// <summary>Who uploaded it.</summary>
    public Guid StaffId { get; private set; }

    public DateTimeOffset TakenAt { get; private set; }

    protected PatientImage() { }

    public static PatientImage Attach(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string blobName,
        string fileName,
        string contentType,
        long sizeBytes,
        Guid staffId,
        DateTimeOffset takenAt,
        Guid? treatmentPlanId = null,
        Guid? treatmentStageId = null,
        string? note = null)
    {
        Check.NotNullOrWhiteSpace(blobName, nameof(blobName));
        Check.NotNullOrWhiteSpace(fileName, nameof(fileName));

        if (sizeBytes <= 0 || sizeBytes > MaxSizeBytes)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidImageFile,
                $"An image must be between 1 byte and {MaxSizeBytes / (1024 * 1024)} MB.");
        }

        if (!IsSupportedImage(contentType))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.UnsupportedImageType,
                $"'{contentType}' is not a supported image type.");
        }

        return new PatientImage
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            BlobName = blobName,
            FileName = fileName,
            ContentType = contentType,
            SizeBytes = sizeBytes,
            StaffId = staffId,
            TakenAt = takenAt,
            TreatmentPlanId = treatmentPlanId,
            TreatmentStageId = treatmentStageId,
            Note = note
        };
    }

    /// <summary>
    /// X-rays arrive as JPEG or PNG; DICOM is explicitly out of scope, so it is
    /// refused rather than stored and never rendered.
    /// </summary>
    public static bool IsSupportedImage(string? contentType) =>
        contentType?.ToLowerInvariant() switch
        {
            "image/jpeg" or "image/jpg" or "image/png" or "image/webp" => true,
            _ => false
        };

    public PatientImage UpdateNote(string? note)
    {
        Note = note;
        return this;
    }
}
