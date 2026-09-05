using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Appointments;

/// <summary>A snapshot of an appointment inside a history row.</summary>
public class AppointmentSnapshotDto
{
    public Guid Id { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset ToTime { get; set; }
    public int Duration { get; set; }
    public AppointmentStatus Status { get; set; }
    public string? Note { get; set; }
    public string? Content { get; set; }
    public string? Color { get; set; }
    public Guid? StaffId { get; set; }
    public string? StaffName { get; set; }
    public Guid BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public CancellationReason? CancelReason { get; set; }
    public string? CancelNote { get; set; }
    public bool IsTemporary { get; set; }
}

public class AppointmentFieldChangeDto
{
    public string Field { get; set; } = "";
    public string? Before { get; set; }
    public string? After { get; set; }
}

public class AppointmentChangeLogDto : EntityDto<Guid>
{
    public Guid AppointmentId { get; set; }
    public Guid? PatientId { get; set; }
    public Guid BranchId { get; set; }
    public AppointmentChangeAction Action { get; set; }
    public AppointmentChangeSource Source { get; set; }
    public AppointmentStatus? StatusBefore { get; set; }
    public AppointmentStatus? StatusAfter { get; set; }
    public List<string> ChangedFields { get; set; } = [];
    public bool IsImportant { get; set; }

    public Guid? ActorUserId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorUserName { get; set; }
    public string? ActorRole { get; set; }

    public string? IpAddress { get; set; }
    public string? Browser { get; set; }
    public string? OperatingSystem { get; set; }
    public string? UserAgent { get; set; }

    public DateTime OccurredAt { get; set; }

    public AppointmentSnapshotDto? Before { get; set; }
    public AppointmentSnapshotDto? After { get; set; }
    public List<AppointmentFieldChangeDto> Diff { get; set; } = [];
}

public class GetAppointmentChangeLogListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? AppointmentId { get; set; }

    /// <summary>Clinic-local calendar days (UTC+7), inclusive.</summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    public AppointmentChangeAction? Action { get; set; }

    /// <summary>Any of several actions; the dialog's Hành động box is a multi-select.</summary>
    public List<AppointmentChangeAction>? Actions { get; set; }

    /// <summary>Matches the status the appointment ended up in.</summary>
    public AppointmentStatus? Status { get; set; }

    /// <summary>
    /// Same as <see cref="Status"/> but any of several, for the dialog's
    /// grouped statuses (e.g. "Đã đến" = CheckedIn, InProgress, Completed).
    /// </summary>
    public List<AppointmentStatus>? Statuses { get; set; }

    public AppointmentChangeSource? Source { get; set; }

    /// <summary>Any of several sources; the dialog's Nguồn box is a multi-select.</summary>
    public List<AppointmentChangeSource>? Sources { get; set; }

    /// <summary>Actor name or username, contains.</summary>
    public string? Actor { get; set; }

    /// <summary>Searches the stored before/after values.</summary>
    public string? Keyword { get; set; }

    public bool? ImportantOnly { get; set; }
}

public class AppointmentChangeLogStatsDto
{
    public int Total { get; set; }
    public Dictionary<AppointmentChangeAction, int> ByAction { get; set; } = [];
    public Dictionary<AppointmentStatus, int> ByStatusTo { get; set; } = [];
    public Dictionary<AppointmentStatus, int> ByStatusFrom { get; set; } = [];
    public Dictionary<AppointmentChangeSource, int> BySource { get; set; } = [];
    public int Important { get; set; }
}
