using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public class PrescriptionItemDto : EntityDto<Guid>
{
    public Guid MedicationId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public decimal Morning { get; set; }
    public decimal Noon { get; set; }
    public decimal Afternoon { get; set; }
    public decimal Evening { get; set; }
    public int Days { get; set; }
    /// <summary>Read side only — (Morning + Noon + Afternoon + Evening) × Days.</summary>
    public decimal Quantity { get; set; }
    public PrescriptionUsage Usage { get; set; }
    public string? OtherUsage { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>A diagnosis picked from a phiếu điều trị, as snapshotted on the slip.</summary>
public class PrescriptionDiagnosisDto
{
    public Guid TreatmentPlanId { get; set; }
    public Guid DiagnosisId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string DiagnosisName { get; set; } = string.Empty;
    public List<int> ToothCodes { get; set; } = [];
    public int SortOrder { get; set; }
}

public class PrescriptionDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
    /// <summary>Resolved display name of the prescribing doctor.</summary>
    public string? StaffName { get; set; }
    public string? DiagnosisText { get; set; }
    public string? DiagnosisNote { get; set; }
    public string? Note { get; set; }
    public PrescriptionTreatmentType TreatmentType { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public DateTimeOffset IssuedAt { get; set; }
    public List<PrescriptionDiagnosisDto> Diagnoses { get; set; } = [];
    public List<PrescriptionItemDto> Items { get; set; } = [];
}

public class CreatePrescriptionItemDto
{
    [Required]
    public Guid MedicationId { get; set; }
    public decimal Morning { get; set; }
    public decimal Noon { get; set; }
    public decimal Afternoon { get; set; }
    public decimal Evening { get; set; }
    public int Days { get; set; } = 1;
    public PrescriptionUsage Usage { get; set; }
    [StringLength(200)]
    public string? OtherUsage { get; set; }
}

/// <summary>
/// One pick of the "Chẩn đoán" block: a diagnosis of one phiếu điều trị. The
/// server snapshots plan code, name and teeth itself — the client sends ids only.
/// </summary>
public class PrescriptionDiagnosisInput
{
    [Required]
    public Guid TreatmentPlanId { get; set; }

    [Required]
    public Guid DiagnosisId { get; set; }
}

/// <summary>
/// The "BE:Treatment:AddPrescription" dialog. When <see cref="SaveAsTemplate"/> is on, the
/// lines and the lời dặn are also stored as a "BE:Common:RxTemplate" catalog entry
/// named <see cref="TemplateName"/>.
/// </summary>
public class CreatePrescriptionDto
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid ClinicBranchId { get; set; }

    [Required]
    public Guid StaffId { get; set; }

    [StringLength(2000)]
    public string? DiagnosisText { get; set; }

    [StringLength(2000)]
    public string? DiagnosisNote { get; set; }

    public List<PrescriptionDiagnosisInput> Diagnoses { get; set; } = [];

    [StringLength(1000)]
    public string? Note { get; set; }

    public PrescriptionTreatmentType TreatmentType { get; set; } = PrescriptionTreatmentType.Outpatient;

    public DateOnly? FollowUpDate { get; set; }

    public bool SaveAsTemplate { get; set; }

    [StringLength(200)]
    public string? TemplateName { get; set; }

    [Required]
    [MinLength(1)]
    public List<CreatePrescriptionItemDto> Items { get; set; } = [];
}

public class UpdatePrescriptionDto
{
    [Required]
    public Guid StaffId { get; set; }

    [StringLength(2000)]
    public string? DiagnosisText { get; set; }

    [StringLength(2000)]
    public string? DiagnosisNote { get; set; }

    public List<PrescriptionDiagnosisInput> Diagnoses { get; set; } = [];

    [StringLength(1000)]
    public string? Note { get; set; }

    public PrescriptionTreatmentType TreatmentType { get; set; } = PrescriptionTreatmentType.Outpatient;

    public DateOnly? FollowUpDate { get; set; }

    public bool SaveAsTemplate { get; set; }

    [StringLength(200)]
    public string? TemplateName { get; set; }

    [Required]
    [MinLength(1)]
    public List<CreatePrescriptionItemDto> Items { get; set; } = [];
}

public class GetPrescriptionListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}

public class GetPrescriptionDiagnosisSourcesInput
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid ClinicBranchId { get; set; }
}

/// <summary>
/// One row of the "Phiếu điều trị" picker: a diagnosis of one phiếu điều trị,
/// with the teeth of every live line carrying it and the distinct notes the
/// doctor wrote for it (line note, else the source phiếu chẩn đoán's note).
/// </summary>
public class PrescriptionDiagnosisSourceDto
{
    public Guid TreatmentPlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public DateTime PlanCreationTime { get; set; }
    public Guid DiagnosisId { get; set; }
    public string DiagnosisName { get; set; } = string.Empty;
    public List<int> ToothCodes { get; set; } = [];
    public List<string> Notes { get; set; } = [];
}

public interface IPrescriptionAppService : IApplicationService
{
    Task<ListResultDto<PrescriptionDiagnosisSourceDto>> GetDiagnosisSourcesAsync(
        GetPrescriptionDiagnosisSourcesInput input);
    Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input);
    Task<PrescriptionDto> GetAsync(Guid id);
    Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input);
    Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input);
    Task DeleteAsync(Guid id);
}
