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

    /// <summary>The longest "Ghi chú" a picture keeps; the column is this wide.</summary>
    public const int MaxNoteLength = 1000;

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Treatment slip this image belongs to, when it was taken for one.</summary>
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>Công đoạn this image documents, when it was taken for one.</summary>
    public Guid? TreatmentStageId { get; private set; }

    /// <summary>Phiếu Labo this image was attached to on the order's detail dialog, when it was.</summary>
    public Guid? LaboOrderId { get; private set; }

    /// <summary>
    /// Ảnh kiểm tra: the receive-and-check round of <see cref="LaboOrderId"/>
    /// the picture was taken in (P2910_03). Null on the pictures sent to the lab
    /// with the order itself.
    /// </summary>
    public int? LaboRoundNo { get; private set; }

    /// <summary>
    /// The tooth row of <see cref="LaboOrderId"/> the picture belongs to (P3110):
    /// an FDI number, <see cref="AllLaboTeeth"/> for the row "Dùng chung" applies
    /// to every tooth, null for Ảnh đính kèm chung.
    /// </summary>
    public int? LaboToothNumber { get; private set; }

    public const int AllLaboTeeth = 0;

    /// <summary>
    /// Set on a photo of a warranty card — the Labo card of
    /// <see cref="LaboToothNumber"/> (P3110 REQ-E1) or the dental card
    /// <see cref="ServiceWarrantyCardId"/> (REQ-B5) — rather than a picture of the
    /// work; null on every other image.
    /// </summary>
    public WarrantyCardSide? WarrantyCardSide { get; private set; }

    /// <summary>The dental warranty card ("Bảo hành nha khoa") this photo shows a face of.</summary>
    public Guid? ServiceWarrantyCardId { get; private set; }

    /// <summary>Name of the blob in object storage.</summary>
    public string BlobName { get; private set; } = string.Empty;

    /// <summary>Original file name, shown to the user.</summary>
    public string FileName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long SizeBytes { get; private set; }

    public string? Note { get; private set; }

    /// <summary>
    /// Who uploaded it — null on a picture an X-ray PC put on the record by
    /// its code (F-95), which nobody uploaded.
    /// </summary>
    public Guid? StaffId { get; private set; }

    /// <summary>The X-ray PC the picture came from (F-95); null on a picture uploaded by hand.</summary>
    public Guid? XrayDeviceId { get; private set; }

    public DateTimeOffset TakenAt { get; private set; }

    /// <summary>Giai đoạn điều trị the image documents.</summary>
    public PatientImageType Type { get; private set; } = PatientImageType.Before;

    /// <summary>
    /// 1-based position in the patient's sequence of images. Uploads append at
    /// the end, so the sequence follows time until the user drags a card; the
    /// tab groups by day and orders each day's cards by this value.
    /// </summary>
    public int Ordering { get; private set; } = 1;

    protected PatientImage() { }

    public static PatientImage Attach(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string blobName,
        string fileName,
        string contentType,
        long sizeBytes,
        Guid? staffId,
        DateTimeOffset takenAt,
        Guid? treatmentPlanId = null,
        Guid? treatmentStageId = null,
        string? note = null,
        PatientImageType type = PatientImageType.Before,
        int ordering = 1,
        Guid? laboOrderId = null,
        int? laboRoundNo = null,
        int? laboToothNumber = null,
        WarrantyCardSide? warrantyCardSide = null,
        Guid? serviceWarrantyCardId = null,
        Guid? xrayDeviceId = null)
    {
        Check.NotNullOrWhiteSpace(blobName, nameof(blobName));
        Check.NotNullOrWhiteSpace(fileName, nameof(fileName));
        CheckOrdering(ordering);
        note = NormalizeNote(note);

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
            XrayDeviceId = xrayDeviceId,
            TakenAt = takenAt,
            TreatmentPlanId = treatmentPlanId,
            TreatmentStageId = treatmentStageId,
            Note = note,
            Type = type,
            Ordering = ordering,
            LaboOrderId = laboOrderId,
            LaboRoundNo = laboOrderId.HasValue ? laboRoundNo : null,
            LaboToothNumber = laboOrderId.HasValue ? laboToothNumber : null,
            ServiceWarrantyCardId = serviceWarrantyCardId,
            WarrantyCardSide = laboOrderId.HasValue || serviceWarrantyCardId.HasValue ? warrantyCardSide : null
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

    /// <summary>The clinic day the picture was uploaded on.</summary>
    public DateOnly UploadedOn => ClinicCalendar.DateOf(DateTime.SpecifyKind(CreationTime, DateTimeKind.Utc));

    /// <summary>
    /// A công đoạn picture can be deleted on the day it was uploaded and no
    /// later (P0111_02, R-1111); every other picture stays deletable.
    /// </summary>
    public bool IsDeletableOn(DateOnly today) => TreatmentStageId is null || UploadedOn == today;

    public void EnsureDeletableOn(DateOnly today)
    {
        if (!IsDeletableOn(today))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.StageImageDeleteExpired,
                "A treatment-stage picture can only be deleted on the day it was uploaded.");
        }
    }

    public PatientImage UpdateNote(string? note)
    {
        Note = NormalizeNote(note);
        return this;
    }

    /// <summary>Trimmed, blank kept as no note at all, and no longer than the column.</summary>
    private static string? NormalizeNote(string? note)
    {
        var trimmed = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        return Check.Length(trimmed, nameof(note), MaxNoteLength);
    }

    /// <summary>Puts the image at a new position in its patient's sequence.</summary>
    public PatientImage MoveTo(int ordering)
    {
        CheckOrdering(ordering);
        Ordering = ordering;
        return this;
    }

    private static void CheckOrdering(int ordering)
    {
        if (ordering < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidImageOrdering,
                "An image position starts at 1.");
        }
    }
}
