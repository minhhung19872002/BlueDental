using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

public class PrescriptionDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid TreatmentRecordId { get; set; }
    public Guid PrescribedBy { get; set; }
    public string? PrescribedByName { get; set; }
    public Guid MedicationId { get; set; }
    public string? MedicationName { get; set; }
    public string Dosage { get; set; } = default!;
    public string Frequency { get; set; } = default!;
    public int DurationDays { get; set; }
    public string? Instructions { get; set; }
    public string Status { get; set; } = default!;
    public DateTimeOffset IssuedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

public class GetPrescriptionListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
}
