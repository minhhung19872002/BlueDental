using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public class PrescriptionItemDto : EntityDto<Guid>
{
    public Guid MedicationId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public int Quantity { get; set; }
    public string? Instructions { get; set; }
}

public class PrescriptionDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
    public Guid? PatientDiagnosisId { get; set; }
    public string? DiagnosisText { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public string? Note { get; set; }
    public PrescriptionStatus Status { get; set; }
    public DateTimeOffset IssuedAt { get; set; }
    public List<PrescriptionItemDto> Items { get; set; } = new();
    public string? StaffName { get; set; }
}

public class CreatePrescriptionItemDto
{
    public Guid MedicationId { get; set; }
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; } = 1;
    public int Quantity { get; set; } = 1;
    public string? Instructions { get; set; }
}

public class CreatePrescriptionDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? PatientDiagnosisId { get; set; }
    public string? DiagnosisText { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public string? Note { get; set; }
    public List<CreatePrescriptionItemDto> Items { get; set; } = new();
}

public class UpdatePrescriptionDto
{
    public Guid StaffId { get; set; }
    public string? DiagnosisText { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public string? Note { get; set; }
    public List<CreatePrescriptionItemDto> Items { get; set; } = new();
}

public class GetPrescriptionListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public PrescriptionStatus? Status { get; set; }
}

/// <summary>
/// Đơn thuốc — reference: <c>/prescriptions</c>, ability subject <c>prescription</c>.
/// </summary>
public interface IPrescriptionAppService : IApplicationService
{
    Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input);
    Task<PrescriptionDto> GetAsync(Guid id);
    Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input);
    Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input);
    Task<PrescriptionDto> DispenseAsync(Guid id);
    Task<PrescriptionDto> CancelAsync(Guid id);
    Task DeleteAsync(Guid id);

    /// <summary>In đơn thuốc.</summary>
    Task<byte[]> ExportPdfAsync(Guid id);
}
