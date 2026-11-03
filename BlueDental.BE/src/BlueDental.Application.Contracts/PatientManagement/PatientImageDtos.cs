using System;
using System.IO;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

public class PatientImageDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? TreatmentStageId { get; set; }
    public Guid? LaboOrderId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Note { get; set; }
    public Guid StaffId { get; set; }
    public DateTimeOffset TakenAt { get; set; }
    public PatientImageType Type { get; set; }

    /// <summary>1-based position in the patient's sequence; see <see cref="PatientImage.Ordering"/>.</summary>
    public int Ordering { get; set; }

    /// <summary>Where the browser fetches the bytes from.</summary>
    public string Url { get; set; } = string.Empty;

    public string? StaffName { get; set; }

    /// <summary>Xóa ảnh is offered: false on a công đoạn picture once its upload day is over (R-1111).</summary>
    public bool Deletable { get; set; }
}

public class UploadPatientImageDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? TreatmentStageId { get; set; }
    /// <summary>The labo order the picture was attached to, from its detail dialog.</summary>
    public Guid? LaboOrderId { get; set; }

    /// <summary>The Labo check round this is an Ảnh kiểm tra of (P2910_03).</summary>
    public int? LaboRoundNo { get; set; }

    /// <summary>The Labo tooth row (FDI, 0 = every tooth) the picture belongs to (P3110).</summary>
    public int? LaboToothNumber { get; set; }

    /// <summary>A photo of that tooth's warranty card, this face of it (P3110 REQ-E1).</summary>
    public WarrantyCardSide? WarrantyCardSide { get; set; }

    /// <summary>The dental warranty card the photo shows (P3110 REQ-B5); its face is <see cref="WarrantyCardSide"/>.</summary>
    public Guid? ServiceWarrantyCardId { get; set; }
    public string? Note { get; set; }

    /// <summary>Giai đoạn điều trị; the tab sends the stage of the column the upload came from.</summary>
    public PatientImageType Type { get; set; } = PatientImageType.Before;

    /// <summary>The uploaded file itself.</summary>
    public IRemoteStreamContent File { get; set; } = default!;
}

/// <summary>Reference: <c>PUT /patient-images/reorder</c> with <c>{ id, ordering }</c>.</summary>
public class ReorderPatientImageDto
{
    public Guid Id { get; set; }

    /// <summary>The position the image should take; the others shift around it.</summary>
    public int Ordering { get; set; }
}

public class GetPatientImageListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? TreatmentStageId { get; set; }
    public PatientImageType? Type { get; set; }

    /// <summary>
    /// The Hình ảnh tab's search box: pictures whose "Ghi chú" contains it, in
    /// any case and with or without Vietnamese marks.
    /// </summary>
    public string? Filter { get; set; }
}

/// <summary>
/// Hình ảnh bệnh nhân — reference: <c>/patient-images</c>, ability subject
/// <c>treatmentImage</c>. Bytes live in object storage; only the reference is
/// stored in PostgreSQL.
/// </summary>
public interface IPatientImageAppService : IApplicationService
{
    Task<PagedResultDto<PatientImageDto>> GetListAsync(GetPatientImageListInput input);
    Task<PatientImageDto> UploadAsync(UploadPatientImageDto input);
    Task<Stream> GetContentAsync(Guid id);
    Task ReorderAsync(ReorderPatientImageDto input);
    Task DeleteAsync(Guid id);
}
