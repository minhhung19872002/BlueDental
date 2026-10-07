using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Marketing;

/// <summary>One row of Marketing → Ticket, with the names the table shows.</summary>
public class TicketDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Code { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string? Email { get; set; }
    public string? Note { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public TicketChannel Channel { get; set; }
    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime ReceivedAt { get; set; }
    public Guid? PatientId { get; set; }
    public string? PatientCode { get; set; }
    public bool IsReturningCustomer { get; set; }
    public Guid? AppointmentId { get; set; }
    public DateTimeOffset? AppointmentStart { get; set; }
    public TicketStatus Status { get; set; }
    public int? ProcessingDays { get; set; }
    public DateTime? DueAt { get; set; }
    public bool IsOverdue { get; set; }
    public int ContactCount { get; set; }
    public DateTime? LastContactAt { get; set; }
    public TicketContactResult? LastContactResult { get; set; }
    public DateTime? NextCallAt { get; set; }
    public string? NotPotentialReason { get; set; }
    public List<Guid> TagIds { get; set; } = [];
    public Guid? CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public DateTime CreationTime { get; set; }
    public bool IsDeleted { get; set; }
    public string? DeleteReason { get; set; }
    public DateTime? DeletionTime { get; set; }
    public string? DeleterName { get; set; }
}

public class GetTicketListInput : PagedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Matches the name, the phone or the code.</summary>
    [StringLength(100)]
    public string? Filter { get; set; }

    public List<TicketStatus>? Statuses { get; set; }
    public Guid? TagId { get; set; }
    public Guid? AssigneeId { get; set; }

    /// <summary>Only the pool — tickets nobody owns yet.</summary>
    public bool Unassigned { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public TicketChannel? Channel { get; set; }

    /// <summary>Clinic days (UTC+7) of Ngày nhận, inclusive.</summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    public bool OverdueOnly { get; set; }

    /// <summary>Only tickets whose Hẹn gọi lại time has come.</summary>
    public bool CallBackDue { get; set; }

    public bool? ReturningCustomer { get; set; }

    /// <summary>Only the tickets one Ticket File created (BA 8.4).</summary>
    public Guid? ImportFileId { get; set; }

    /// <summary>The Đã xoá list instead of the live one.</summary>
    public bool Deleted { get; set; }
}

/// <summary>
/// Chuyển Ticket (BA 8.3): every ticket the list filter matches goes to the
/// chosen staff, dealt in turn so several people share them evenly.
/// </summary>
public class TransferTicketsDto : GetTicketListInput
{
    [Required]
    [MinLength(1)]
    public List<Guid> AssigneeIds { get; set; } = [];
}

public class TicketTransferResultDto
{
    /// <summary>Tickets the filter matched.</summary>
    public int Matched { get; set; }

    /// <summary>Of those, the ones that changed hands (a ticket dealt to its own assignee stays as it is).</summary>
    public int Transferred { get; set; }
}

/// <summary>The KPI strip: counts for the filter, every status at once.</summary>
public class TicketStatsDto
{
    public int Total { get; set; }
    public int New { get; set; }
    public int InCare { get; set; }
    public int Booked { get; set; }
    public int Arrived { get; set; }
    public int NotPotential { get; set; }
    public int Overdue { get; set; }
    public int CallBackDue { get; set; }
}

public class TicketInputDto
{
    [Required]
    [StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Phone { get; set; } = string.Empty;

    [EmailAddress]
    [StringLength(256)]
    public string? Email { get; set; }

    [StringLength(2000)]
    public string? Note { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public List<Guid> TagIds { get; set; } = [];
}

public class CreateTicketDto : TicketInputDto
{
    /// <summary>Defaults to the caller's current branch.</summary>
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Null leaves the ticket in the pool.</summary>
    public Guid? AssigneeId { get; set; }
}

public class UpdateTicketDto : TicketInputDto;

public class CreateTicketResultDto
{
    public TicketDto Ticket { get; set; } = default!;

    /// <summary>
    /// True when the phone already had an open ticket: nothing new was made,
    /// the old one got a Phát sinh lại line instead.
    /// </summary>
    public bool Reoccurred { get; set; }
}

public class RecordTicketContactDto
{
    [Required]
    public TicketContactResult Result { get; set; }

    [StringLength(2000)]
    public string? Note { get; set; }

    /// <summary>Required for <see cref="TicketContactResult.CallBack"/>.</summary>
    public DateTime? NextCallAt { get; set; }
}

public class AssignTicketDto
{
    /// <summary>Null returns the ticket to the pool.</summary>
    public Guid? AssigneeId { get; set; }
}

public class TicketReasonDto
{
    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class BookTicketAppointmentDto
{
    /// <summary>Required when the customer already has a patient record.</summary>
    public Guid? DentistId { get; set; }

    public DateTimeOffset SlotStart { get; set; }
    public DateTimeOffset SlotEnd { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}

public class TicketActivityDto : EntityDto<Guid>
{
    public TicketActivityKind Kind { get; set; }
    public TicketContactResult? ContactResult { get; set; }
    public TicketStatus? FromStatus { get; set; }
    public TicketStatus? ToStatus { get; set; }
    public string? Note { get; set; }
    public DateTime? NextCallAt { get; set; }
    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public Guid? AppointmentId { get; set; }
    public Guid? CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public DateTime CreationTime { get; set; }
}

/// <summary>Someone working at the ticket's branch — whom a ticket may be given to.</summary>
public class TicketAssigneeDto : EntityDto<Guid>
{
    public string Name { get; set; } = default!;
}

/// <summary>One Thẻ ticket.</summary>
public class TicketTagDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public string Color { get; set; } = default!;
    public int? MaxProcessingDays { get; set; }
    public DateTime CreationTime { get; set; }
}

public class GetTicketTagListInput
{
    public Guid? ClinicBranchId { get; set; }

    [StringLength(100)]
    public string? Filter { get; set; }
}

public class TicketTagInputDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^#[0-9a-fA-F]{6}$")]
    public string Color { get; set; } = string.Empty;

    [Range(1, 365)]
    public int? MaxProcessingDays { get; set; }
}

public class CreateTicketTagDto : TicketTagInputDto
{
    public Guid? ClinicBranchId { get; set; }
}

public class UpdateTicketTagDto : TicketTagInputDto;
