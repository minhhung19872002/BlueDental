using System;
using System.Collections.Generic;
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
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public AppointmentOutcome? Outcome { get; set; }

    public int? PatientYearOfBirth { get; set; }
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

    /// <summary>
    /// The edit dialog's Trạng thái. Cancelled or NoShow moves the appointment
    /// there in the same save; Requested or Confirmed puts a cancelled or late
    /// one back on the book. A value in the appointment's current group changes
    /// nothing, the arrival statuses are refused. Left null, the status is not
    /// touched at all.
    /// </summary>
    public AppointmentStatus? Status { get; set; }

    /// <summary>Why, when <see cref="Status"/> is Cancelled; defaults to the patient asking.</summary>
    public CancellationReason? CancellationReason { get; set; }

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

public class AssignDentistDto
{
    public Guid DentistId { get; set; }
}

public class SetOutcomeDto
{
    public AppointmentOutcome Outcome { get; set; }
}

public class GetAppointmentListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? DentistId { get; set; }
    public Guid? BranchId { get; set; }
    public AppointmentStatus? Status { get; set; }
    public List<AppointmentStatus>? Statuses { get; set; }
    public bool? IsTemporary { get; set; }
    public DateOnly? Date { get; set; }

    /// <summary>Inclusive range, for the week and month grids.</summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}

public class AppointmentStatsDto
{
    public int Requested { get; set; }
    public int Confirmed { get; set; }
    public int CheckedIn { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
    public int Temporary { get; set; }
}
