using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using BlueDental.PatientManagement;

namespace BlueDental.Appointments;

public class AppointmentDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public string? PatientCode { get; set; }
    public string PatientName { get; set; } = default!;
    [PatientPhone]
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
    public DateTimeOffset? CancelledAt { get; set; }
    public CancellationReason? CancellationReason { get; set; }
    public string? CancellationNote { get; set; }
    public AppointmentOutcome? Outcome { get; set; }

    /// <summary>The appointment booked through "Đã hẹn tiếp", and when it starts.</summary>
    public Guid? FollowUpAppointmentId { get; set; }
    public DateTimeOffset? FollowUpAt { get; set; }

    public int? PatientYearOfBirth { get; set; }
    public bool IsTemporary { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }

    /// <summary>The "Lặp lại lịch hẹn" series this booking is a session of, if any.</summary>
    public Guid? SeriesId { get; set; }
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

    /// <summary>The written cancel reason; required when the save cancels.</summary>
    [StringLength(500)]
    public string? CancellationNote { get; set; }

    // Temp appointment fields
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
}

public class CancelAppointmentDto
{
    public CancellationReason Reason { get; set; }

    /// <summary>The written reason; a blank one is refused.</summary>
    [StringLength(500)]
    public string? Note { get; set; }
}

public class CompleteAppointmentDto
{
    public string? Notes { get; set; }
    public AppointmentOutcome? Outcome { get; set; }
}

public class StartAppointmentDto
{
    public AppointmentOutcome? Outcome { get; set; }
}

public class AssignDentistDto
{
    public Guid DentistId { get; set; }
}

/// <summary>The patient record created for a "Lịch tạm" walk-in.</summary>
public class AttachPatientDto
{
    public Guid PatientId { get; set; }
}

public class SetOutcomeDto
{
    public AppointmentOutcome Outcome { get; set; }
}

/// <summary>
/// "Đã hẹn tiếp" or "Hẹn tái khám": the next appointment, booked from the
/// reception card together with the outcome it stands for.
/// </summary>
public class BookFollowUpDto
{
    /// <summary>FollowUp or Revisit; any other outcome is refused.</summary>
    public AppointmentOutcome Outcome { get; set; } = AppointmentOutcome.FollowUp;

    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }

    /// <summary>Left null, the follow-up goes to this visit's dentist.</summary>
    public Guid? DentistId { get; set; }

    [StringLength(500)]
    public string? ChiefComplaint { get; set; }
}

/// <summary>
/// "Hẹn lại - Chưa chốt ngày": "Đã hẹn tiếp" / "Hẹn tái khám" saved without a
/// date, handed to customer care (owner, 2026-10-09).
/// </summary>
public class RebookUndatedDto
{
    /// <summary>FollowUp or Revisit; any other outcome is refused.</summary>
    public AppointmentOutcome Outcome { get; set; } = AppointmentOutcome.FollowUp;

    /// <summary>The doctor picked in the panel; left null, this visit's dentist.</summary>
    public Guid? DentistId { get; set; }

    /// <summary>Nội dung đặt lịch — the care task's Nội dung, which holds 300.</summary>
    [StringLength(300)]
    public string? Note { get; set; }
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

    /// <summary>
    /// Trễ hẹn on the reception board: marked late, or still only booked
    /// (Đã hẹn / Đã xác nhận) once its start time has passed. False keeps the rest.
    /// </summary>
    public bool? IsLate { get; set; }

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

    /// <summary>
    /// Of <see cref="Requested"/> and <see cref="Confirmed"/>, those whose start
    /// time has passed with no arrival — the board counts them Trễ hẹn, not Đã hẹn.
    /// </summary>
    public int Overdue { get; set; }
}
