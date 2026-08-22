using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

public class DiagnosticRecordDto : EntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public string? DentistName { get; set; }
    public Guid? AppointmentId { get; set; }
    public string? TeethNumbers { get; set; }
    public string? Diagnosis { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreationTime { get; set; }
}

public class CreateDiagnosticRecordDto
{
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public Guid? AppointmentId { get; set; }
    public string? TeethNumbers { get; set; }
    public string? Diagnosis { get; set; }
    public string? Notes { get; set; }
}

public class GetDiagnosticRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public string? Filter { get; set; }
}
