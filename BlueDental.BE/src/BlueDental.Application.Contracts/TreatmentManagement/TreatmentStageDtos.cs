using System;
using System.Collections.Generic;
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
    public Guid? SecondStaffId { get; set; }
    public DateOnly? ScheduledDate { get; set; }
    public TreatmentStageStatus Status { get; set; }
    public bool IsImageRequired { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public List<string> ImageUrls { get; set; } = new();

    public string? StaffName { get; set; }
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
    public DateOnly? ScheduledDate { get; set; }

    /// <summary>
    /// Omit to inherit the flag from the service catalog entry, which is where the
    /// reference keeps it (<c>serviceDetails.isImageRequired</c>).
    /// </summary>
    public bool? IsImageRequired { get; set; }

    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

public class UpdateTreatmentStageDto
{
    public string Name { get; set; } = string.Empty;
    public string? Note { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public DateOnly? ScheduledDate { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
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
/// as "Trạng thái - Tiến độ" on the treatment-plan table.
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
/// "Dịch vụ có công đoạn gần nhất" card. Mirrors the reference's
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
public interface ITreatmentStageAppService : IApplicationService
{
    Task<PagedResultDto<TreatmentStageDto>> GetListAsync(GetTreatmentStageListInput input);
    Task<TreatmentStageDto> GetAsync(Guid id);
    Task<TreatmentStageProgressDto> GetProgressAsync(Guid treatmentServiceId);
    Task<LatestTreatmentStageDto?> GetLatestAsync(Guid patientId);
    Task<TreatmentStageDto> CreateAsync(CreateTreatmentStageDto input);
    Task<TreatmentStageDto> UpdateAsync(Guid id, UpdateTreatmentStageDto input);
    Task<TreatmentStageDto> ContinueAsync(Guid id);
    Task<TreatmentStageDto> CompleteAsync(Guid id);
    Task<TreatmentStageDto> AttachImageAsync(Guid id, AttachStageImageDto input);
    Task DeleteAsync(Guid id);
}
