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
    public int TimesPerDay { get; set; }
    public decimal AmountPerTime { get; set; }
    public int Days { get; set; }
    /// <summary>Read side only — TimesPerDay × AmountPerTime × Days.</summary>
    public decimal Quantity { get; set; }
    public PrescriptionUsage Usage { get; set; }
    public string? OtherUsage { get; set; }
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
    public string? Note { get; set; }
    public PrescriptionTreatmentType TreatmentType { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public DateTimeOffset IssuedAt { get; set; }
    public List<PrescriptionItemDto> Items { get; set; } = [];
}

public class CreatePrescriptionItemDto
{
    [Required]
    public Guid MedicationId { get; set; }
    public int TimesPerDay { get; set; } = 1;
    public decimal AmountPerTime { get; set; } = 1;
    public int Days { get; set; } = 1;
    public PrescriptionUsage Usage { get; set; }
    [StringLength(200)]
    public string? OtherUsage { get; set; }
}

/// <summary>
/// The "Thêm đơn thuốc" dialog. When <see cref="SaveAsTemplate"/> is on, the
/// lines and the lời dặn are also stored as a "Đơn thuốc mẫu" catalog entry
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

    [StringLength(500)]
    public string? DiagnosisText { get; set; }

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

    [StringLength(500)]
    public string? DiagnosisText { get; set; }

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

public interface IPrescriptionAppService : IApplicationService
{
    Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input);
    Task<PrescriptionDto> GetAsync(Guid id);
    Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input);
    Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input);
    Task DeleteAsync(Guid id);
}
