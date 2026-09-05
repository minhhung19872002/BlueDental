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
}

public class UploadPatientImageDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? TreatmentStageId { get; set; }
    public string? Note { get; set; }

    /// <summary>Giai đoạn điều trị; the tab sends whatever its filter is set to, "Trước điều trị" otherwise.</summary>
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
