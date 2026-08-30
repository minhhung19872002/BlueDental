using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Appointments;

public class AppointmentDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public string? PatientCode { get; set; }
    public string PatientName { get; set; } = default!;
    public string? PatientPhone { get; set; }
    public Guid DentistId { get; set; }
    public string DentistName { get; set; } = default!;
    public Guid BranchId { get; set; }
    public Guid? ProcedureId { get; set; }
    public string? ProcedureName { get; set; }
    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }
    public AppointmentStatus Status { get; set; }
    public AppointmentType Type { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? Notes { get; set; }
    public string? Color { get; set; }

    public bool IsTemporary { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
}

public class CreateTempAppointmentDto
{
    public string PatientName { get; set; } = default!;
    public string? PatientPhone { get; set; }
    public Guid? DentistId { get; set; }
    public Guid BranchId { get; set; }
    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public string? Color { get; set; }
    public string? Notes { get; set; }
}

public class CreateAppointmentDto
{
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? ProcedureId { get; set; }
    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }
    public AppointmentType Type { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? Color { get; set; }
    public string? Notes { get; set; }
}

public class UpdateAppointmentDto
{
    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }
    public Guid? DentistId { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? Notes { get; set; }
    public string? Color { get; set; }

    // Temp appointment fields
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
}

public class CancelAppointmentDto
{
    public CancellationReason Reason { get; set; }
    public string? Note { get; set; }
}

public class CompleteAppointmentDto
{
    public string? Notes { get; set; }
}

public class GetAppointmentListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? DentistId { get; set; }
    public Guid? BranchId { get; set; }
    public AppointmentStatus? Status { get; set; }
    public DateOnly? Date { get; set; }

    /// <summary>Inclusive range, for the week and month grids.</summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}
