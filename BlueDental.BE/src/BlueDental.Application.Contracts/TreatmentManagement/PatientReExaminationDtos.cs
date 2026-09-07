using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tái khám — one row of the treatment table, beside the công đoạn rows.
///
/// The reference returns it from the patient timeline as
/// <c>type: "re_examination"</c> with code <c>REX001</c>. It carries no status,
/// no care record and no stage cell of its own.
/// </summary>
public class PatientReExaminationDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary>REX001, REX002, … per patient.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>The finished công đoạn this follow-up came from.</summary>
    public Guid PatientStageId { get; set; }
    public Guid TreatmentServiceId { get; set; }
    public Guid ServiceId { get; set; }

    public Guid StaffId { get; set; }
    public Guid? SubStaffId { get; set; }
    public Guid? SecondStaffId { get; set; }

    public string? Note { get; set; }

    /// <summary>The teeth ticked in the form — the reference's selectedContent.</summary>
    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public List<string> ImageUrls { get; set; } = new();

    /// <summary>SL on the row, taken from the service line the stage belongs to.</summary>
    public int Quantity { get; set; }

    public string? ServiceName { get; set; }
    public string? StaffName { get; set; }
    public string? SubStaffName { get; set; }
    public string? SecondStaffName { get; set; }
}

public class CreatePatientReExaminationDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary>The finished công đoạn the follow-up is raised from.</summary>
    public Guid PatientStageId { get; set; }

    public Guid StaffId { get; set; }
    public Guid? SubStaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public string? Note { get; set; }

    /// <summary>Only the teeth ticked in the form.</summary>
    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

public class GetPatientReExaminationListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? PatientStageId { get; set; }
}

public interface IPatientReExaminationAppService : IApplicationService
{
    Task<PagedResultDto<PatientReExaminationDto>> GetListAsync(GetPatientReExaminationListInput input);
    Task<PatientReExaminationDto> CreateAsync(CreatePatientReExaminationDto input);
    Task<PatientReExaminationDto> AttachImageAsync(Guid id, AttachStageImageDto input);
}
