using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public class TreatmentStageDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentId { get; set; }
    public Guid TreatmentServiceId { get; set; }
    public Guid ServiceId { get; set; }
    public int SequenceNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Note { get; set; }
    public Guid StaffId { get; set; }
    /// <summary>Bác sĩ hỗ trợ — the reference's <c>assistantStaffId</c>.</summary>
    public Guid? SecondStaffId { get; set; }
    /// <summary>Phụ tá — the reference's <c>subStaffId</c>.</summary>
    public Guid? SubStaffId { get; set; }
    public DateOnly? ScheduledDate { get; set; }
    public TreatmentStageStatus Status { get; set; }
    public bool IsImageRequired { get; set; }
    /// <summary>Bảo hành — the reference's <c>isGuarantee</c>.</summary>
    public bool IsGuarantee { get; set; }
    /// <summary>Whether a tái khám has been raised from this công đoạn.</summary>
    public bool HasReExamination { get; set; }

    /// <summary>
    /// A later công đoạn continued this one — the reference's <c>disabled</c>.
    /// The history greys it out and nothing on it can be worked any more.
    /// </summary>
    public bool IsSuperseded { get; set; }

    /// <summary>The công đoạn this one continues; null at the head of a chain.</summary>
    public Guid? ContinuedFromId { get; set; }

    /// <summary>On a warranty: the ordinary công đoạn it descends from.</summary>
    public Guid? WarrantyRootStageId { get; set; }

    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public List<string> ImageUrls { get; set; } = new();

    /// <summary>
    /// "BE:Treatment:StageList" — the service steps this công đoạn covers, in the
    /// service's own order, each with its tick.
    /// </summary>
    public List<StageServiceItemDto> ServiceItems { get; set; } = new();

    public string? StaffName { get; set; }
    public string? SecondStaffName { get; set; }
    public string? SubStaffName { get; set; }
    public string? ServiceName { get; set; }
}

public class CreateTreatmentStageDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentId { get; set; }
    public Guid TreatmentServiceId { get; set; }
    public Guid ServiceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Note { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public Guid? SubStaffId { get; set; }
    public DateOnly? ScheduledDate { get; set; }
    /// <summary>Set by "Tạo bảo hành"; an ordinary công đoạn leaves it false.</summary>
    public bool IsGuarantee { get; set; }

    /// <summary>
    /// Required with <see cref="IsGuarantee"/>: the finished công đoạn the
    /// warranty is raised from. The server checks it is live, finished and inside
    /// the service's warranty period, and bounds the teeth by its root's.
    /// </summary>
    public Guid? WarrantySourceStageId { get; set; }


    /// <summary>
    /// Omit to inherit the flag from the service catalog entry, which is where the
    /// reference keeps it (<c>serviceDetails.isImageRequired</c>).
    /// </summary>
    public bool? IsImageRequired { get; set; }

    public List<ToothSelectionDto> Teeth { get; set; } = new();

    /// <summary>
    /// Which of the service's own công đoạn steps this one covers — the boxes
    /// ticked under "BE:Treatment:StageList". They are stored unticked; the history
    /// row is where they get ticked off.
    /// </summary>
    public List<Guid> ServiceItemIds { get; set; } = new();
}

public class UpdateTreatmentStageDto
{
    public string Name { get; set; } = string.Empty;
    public string? Note { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public Guid? SubStaffId { get; set; }
    public DateOnly? ScheduledDate { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

/// <summary>
/// "Tiếp tục công đoạn" / "Tiếp tục bảo hành" — the next visit of a chain. The
/// teeth are the chain's own and are not sent: the reference locks them on the
/// form and refuses a continue whose teeth differ.
/// </summary>
public class ContinueTreatmentStageDto
{
    [Required]
    public Guid StaffId { get; set; }

    /// <summary>Bác sĩ hỗ trợ.</summary>
    public Guid? SecondStaffId { get; set; }

    /// <summary>Phụ tá.</summary>
    public Guid? SubStaffId { get; set; }

    /// <summary>Nội dung điều trị — required and capped at 1000, as on the form.</summary>
    [Required]
    [StringLength(1000)]
    public string Note { get; set; } = string.Empty;

    /// <summary>The steps ticked under "Danh sách công đoạn"; stored unticked.</summary>
    public List<Guid> ServiceItemIds { get; set; } = new();
}

public class AttachStageImageDto
{
    public string ImageUrl { get; set; } = string.Empty;
}

public class GetTreatmentStageListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? TreatmentId { get; set; }
    public Guid? TreatmentServiceId { get; set; }
    public Guid? StaffId { get; set; }
    public TreatmentStageStatus? Status { get; set; }
}

/// <summary>
/// Progress of one service line, derived from its stages — the reference shows this
/// as "BE:Field:StatusProgress" on the treatment-plan table.
/// </summary>
public class TreatmentStageProgressDto
{
    public Guid TreatmentServiceId { get; set; }
    public int Total { get; set; }
    public int Completed { get; set; }
    public int InProgress { get; set; }
    public int Pending { get; set; }

    /// <summary>Completed stages as a percentage, 0 when the service has no stages yet.</summary>
    public int ProgressPercent { get; set; }
}

/// <summary>
/// "BE:CareType:ServiceLatestStage" card. Mirrors the reference's
/// <c>summary.recent[]</c> element.
/// </summary>
public class LatestTreatmentStageDto
{
    public Guid TreatmentServiceId { get; set; }
    public Guid? TreatmentId { get; set; }
    public Guid StageId { get; set; }
    public string? ServiceName { get; set; }
    public string? StageNote { get; set; }
    public DateTimeOffset StageDate { get; set; }
}

/// <summary>
/// Công đoạn điều trị. The reference guards it with the <c>treatmentStage</c>
/// subject, whose verbs map one-to-one onto the operations below.
/// </summary>
/// <summary>One row of "BE:Treatment:StageList", named from the service catalog.</summary>
public class StageServiceItemDto
{
    /// <summary>The service's own step — the reference's <c>stageServiceId</c>.</summary>
    public Guid CatalogServiceStageId { get; set; }

    /// <summary>Read from <c>CatalogServiceStage</c>, never copied onto the stage.</summary>
    public string Name { get; set; } = string.Empty;

    public bool IsCompleted { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public Guid? StaffId { get; set; }
}

public class UpdateStageServiceItemsDto
{
    /// <summary>
    /// The whole picture for this công đoạn: any step left out is treated as
    /// unticked, which is what lets one call both tick and untick.
    /// </summary>
    public List<StageServiceItemStateDto> Items { get; set; } = new();
}

public class StageServiceItemStateDto
{
    public Guid CatalogServiceStageId { get; set; }
    public bool IsCompleted { get; set; }
}

public interface ITreatmentStageAppService : IApplicationService
{
    Task<PagedResultDto<TreatmentStageDto>> GetListAsync(GetTreatmentStageListInput input);
    Task<TreatmentStageDto> GetAsync(Guid id);
    Task<TreatmentStageProgressDto> GetProgressAsync(Guid treatmentServiceId);
    Task<LatestTreatmentStageDto?> GetLatestAsync(Guid patientId);
    Task<TreatmentStageDto> CreateAsync(CreateTreatmentStageDto input);
    Task<TreatmentStageDto> UpdateAsync(Guid id, UpdateTreatmentStageDto input);
    /// <summary>
    /// Writes the next công đoạn of <paramref name="id"/>'s chain and retires
    /// <paramref name="id"/> — the reference's <c>POST patient-stages/{id}/continue</c>.
    /// Returns the new công đoạn.
    /// </summary>
    Task<TreatmentStageDto> ContinueAsync(Guid id, ContinueTreatmentStageDto input);
    Task<TreatmentStageDto> CompleteAsync(Guid id);

    /// <summary>Un-ticks Hoàn thành — the reference's <c>revert-status</c>.</summary>
    Task<TreatmentStageDto> RevertAsync(Guid id);
    Task<TreatmentStageDto> AttachImageAsync(Guid id, AttachStageImageDto input);

    /// <summary>
    /// Ticks or unticks the steps under "BE:Treatment:StageList" — the reference's
    /// <c>PUT /v1/patient-stages/{id}/stage-service-items</c>.
    /// </summary>
    Task<TreatmentStageDto> UpdateServiceItemsAsync(Guid id, UpdateStageServiceItemsDto input);
    Task DeleteAsync(Guid id);
}
