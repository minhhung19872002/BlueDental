using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Appointments;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Marketing;

/// <summary>What a person types about the lead; the rest of a ticket is earned by working it.</summary>
public sealed record TicketDetails(
    string FullName,
    string Phone,
    string? Email,
    string? Note,
    Guid? SourceTaxonomyId,
    Guid? SourceEntryId);

/// <summary>
/// Marketing → Ticket (F-51): one lead the clinic has to turn into a visit.
/// BlueDental-local — the rules are the ones agreed in
/// docs/clone/pages/marketing-ticket.md:
/// <list type="bullet">
/// <item>Mới → Đang chăm sóc on the first contact; Đã đặt hẹn when an
/// appointment is booked from it; Đã đến when that appointment is checked in.</item>
/// <item>Không tiềm năng is closed by hand, with a reason, and can be reopened.</item>
/// <item>Hạn xử lý (SLA) = start + the shortest processing time of its tags.
/// The start is the receipt, or the last (re)assignment.</item>
/// </list>
/// Every step returns the timeline line it wrote, for the caller to insert.
/// </summary>
public class Ticket : FullAuditedAggregateRoot<Guid>
{
    public const int MaxCodeLength = 20;
    public const int MaxFullNameLength = 200;
    public const int MaxPhoneLength = 20;
    public const int MaxEmailLength = 256;
    public const int MaxNoteLength = 2000;
    public const int MaxReasonLength = 500;

    public Guid ClinicBranchId { get; private set; }

    /// <summary>TK000001 — numbered per branch.</summary>
    public string Code { get; private set; } = string.Empty;

    public string FullName { get; private set; } = string.Empty;

    /// <summary>Normalised by <see cref="TicketPhone.Normalize"/>.</summary>
    public string Phone { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    public string? Note { get; private set; }

    /// <summary>Nguồn (a taxonomy group of Danh mục → Nguồn đến).</summary>
    public Guid? SourceTaxonomyId { get; private set; }

    /// <summary>Kênh (an entry of that group).</summary>
    public Guid? SourceEntryId { get; private set; }

    public TicketChannel Channel { get; private set; }

    /// <summary>Người phụ trách. Null = the unassigned pool.</summary>
    public Guid? AssigneeId { get; private set; }

    public DateTime? AssignedAt { get; private set; }

    public DateTime ReceivedAt { get; private set; }

    /// <summary>When the SLA clock last started: receipt, or the last (re)assignment.</summary>
    public DateTime SlaStartAt { get; private set; }

    /// <summary>The patient record the phone matched, or the one booking created.</summary>
    public Guid? PatientId { get; private set; }

    /// <summary>Khách cũ: the phone already belonged to a patient when the ticket came in.</summary>
    public bool IsReturningCustomer { get; private set; }

    /// <summary>The last appointment booked from the ticket.</summary>
    public Guid? AppointmentId { get; private set; }

    public TicketStatus Status { get; private set; }

    /// <summary>The shortest Thời gian xử lý of the tags, in days. Null = no deadline.</summary>
    public int? ProcessingDays { get; private set; }

    public DateTime? DueAt { get; private set; }

    public int ContactCount { get; private set; }

    public DateTime? LastContactAt { get; private set; }

    public TicketContactResult? LastContactResult { get; private set; }

    /// <summary>Hẹn gọi lại lúc — set only while the last contact asked for a call back.</summary>
    public DateTime? NextCallAt { get; private set; }

    public string? NotPotentialReason { get; private set; }

    public string? DeleteReason { get; private set; }

    private List<Guid> _tagIds = [];

    public IReadOnlyCollection<Guid> TagIds => _tagIds.AsReadOnly();

    protected Ticket() { }

    public static (Ticket Ticket, TicketActivity Activity) Create(
        Guid id,
        Guid activityId,
        Guid clinicBranchId,
        string code,
        TicketDetails details,
        TicketChannel channel,
        Guid? assigneeId,
        DateTime now)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code), MaxCodeLength);
        if (!Enum.IsDefined(channel))
        {
            throw new ArgumentOutOfRangeException(nameof(channel));
        }

        var ticket = new Ticket
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Code = code,
            Channel = channel,
            Status = TicketStatus.New,
            ReceivedAt = now,
            SlaStartAt = now,
            AssigneeId = assigneeId,
            AssignedAt = assigneeId.HasValue ? now : null,
        };
        ticket.Update(details);
        var activity = new TicketActivity(activityId, id, TicketActivityKind.Created, TicketStatus.New, TicketStatus.New)
            .WithAssignee(assigneeId);
        return (ticket, activity);
    }

    public bool IsOpen => Status is TicketStatus.New or TicketStatus.InCare or TicketStatus.Booked;

    /// <summary>Quá hạn: past its deadline while nobody has booked the customer yet.</summary>
    public bool IsOverdue(DateTime now) =>
        DueAt < now && Status is TicketStatus.New or TicketStatus.InCare;

    public Ticket Update(TicketDetails details)
    {
        FullName = Check.NotNullOrWhiteSpace(details.FullName, nameof(details.FullName), MaxFullNameLength).Trim();
        Phone = TicketPhone.Normalize(details.Phone);
        Email = Optional(details.Email, nameof(details.Email), MaxEmailLength);
        Note = Optional(details.Note, nameof(details.Note), MaxNoteLength);
        SourceTaxonomyId = details.SourceTaxonomyId;
        SourceEntryId = details.SourceTaxonomyId.HasValue ? details.SourceEntryId : null;
        return this;
    }

    /// <summary>Replaces the tags; <paramref name="processingDays"/> is the shortest of theirs.</summary>
    public Ticket SetTags(IEnumerable<Guid> tagIds, int? processingDays)
    {
        _tagIds = tagIds.Where(x => x != Guid.Empty).Distinct().ToList();
        ProcessingDays = processingDays;
        RecomputeDue();
        return this;
    }

    public Ticket LinkPatient(Guid patientId, bool returningCustomer)
    {
        PatientId = patientId;
        IsReturningCustomer = IsReturningCustomer || returningCustomer;
        return this;
    }

    /// <summary>
    /// Ghi nhận liên hệ. The first contact moves Mới to Đang chăm sóc; a contact
    /// on a pool ticket makes the caller its owner.
    /// </summary>
    public TicketActivity RecordContact(
        Guid activityId,
        Guid callerId,
        TicketContactResult result,
        string? note,
        DateTime? nextCallAt,
        DateTime now)
    {
        if (!IsOpen)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.TicketClosed);
        }

        if (!Enum.IsDefined(result))
        {
            throw new ArgumentOutOfRangeException(nameof(result));
        }

        if (result == TicketContactResult.CallBack && (nextCallAt is null || nextCallAt <= now))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.CallBackTimeRequired);
        }

        if (AssigneeId is null)
        {
            AssignTo(callerId, now);
        }

        var from = Status;
        if (Status == TicketStatus.New)
        {
            Status = TicketStatus.InCare;
        }

        ContactCount++;
        LastContactAt = now;
        LastContactResult = result;
        NextCallAt = result == TicketContactResult.CallBack ? nextCallAt : null;
        return new TicketActivity(activityId, Id, TicketActivityKind.Contact, from, Status,
                Optional(note, nameof(note), MaxNoteLength))
            .WithContact(result, NextCallAt);
    }

    /// <summary>Giao / chuyển người phụ trách, or back to the pool (null). Restarts the SLA.</summary>
    public TicketActivity Assign(Guid activityId, Guid? assigneeId, DateTime now)
    {
        AssignTo(assigneeId, now);
        return new TicketActivity(activityId, Id, TicketActivityKind.Assigned, Status, Status)
            .WithAssignee(assigneeId);
    }

    public TicketActivity MarkBooked(Guid activityId, Guid appointmentId)
    {
        if (Status is not (TicketStatus.New or TicketStatus.InCare))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        }

        var from = Status;
        Status = TicketStatus.Booked;
        AppointmentId = appointmentId;
        NextCallAt = null;
        return new TicketActivity(activityId, Id, TicketActivityKind.Booked, from, Status)
            .WithAppointment(appointmentId);
    }

    public TicketActivity MarkNotPotential(Guid activityId, string reason)
    {
        if (Status is not (TicketStatus.New or TicketStatus.InCare))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        }

        var trimmed = Check.NotNullOrWhiteSpace(reason, nameof(reason), MaxReasonLength).Trim();
        var from = Status;
        Status = TicketStatus.NotPotential;
        NotPotentialReason = trimmed;
        NextCallAt = null;
        return new TicketActivity(activityId, Id, TicketActivityKind.StatusChanged, from, Status, NotPotentialReason);
    }

    public TicketActivity Reopen(Guid activityId)
    {
        if (Status != TicketStatus.NotPotential)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        }

        Status = TicketStatus.InCare;
        NotPotentialReason = null;
        return new TicketActivity(activityId, Id, TicketActivityKind.StatusChanged, TicketStatus.NotPotential, Status);
    }

    /// <summary>Phát sinh lại: the same phone came in again while this ticket was open.</summary>
    public TicketActivity Reoccur(Guid activityId, string? note) =>
        new(activityId, Id, TicketActivityKind.Reoccurred, Status, Status,
            Optional(note, nameof(note), MaxNoteLength));

    /// <summary>
    /// Follows the booked appointment: checked in → Đã đến; cancelled, missed or
    /// deleted → back to Đang chăm sóc; restored → Đã đặt hẹn again. A ticket
    /// closed by hand, or already arrived, is left alone. Returns null when
    /// nothing moved.
    /// </summary>
    public TicketActivity? FollowAppointment(
        Guid activityId,
        Guid appointmentId,
        Guid patientId,
        AppointmentStatus? appointmentStatus)
    {
        if (AppointmentId != appointmentId)
        {
            return null;
        }

        if (patientId != Guid.Empty && PatientId is null)
        {
            PatientId = patientId;
        }

        var target = (Status, appointmentStatus) switch
        {
            (TicketStatus.Booked or TicketStatus.InCare,
                AppointmentStatus.CheckedIn or AppointmentStatus.InProgress or AppointmentStatus.Completed)
                => TicketStatus.Arrived,
            (TicketStatus.Booked, null or AppointmentStatus.Cancelled or AppointmentStatus.NoShow)
                => TicketStatus.InCare,
            (TicketStatus.InCare, AppointmentStatus.Requested or AppointmentStatus.Confirmed)
                => TicketStatus.Booked,
            _ => Status,
        };

        if (target == Status)
        {
            return null;
        }

        var from = Status;
        Status = target;
        return new TicketActivity(activityId, Id, TicketActivityKind.AppointmentChanged, from, Status)
            .WithAppointment(appointmentId);
    }

    /// <summary>Records why, before the soft delete.</summary>
    public TicketActivity MarkDeleted(Guid activityId, string reason)
    {
        DeleteReason = Check.NotNullOrWhiteSpace(reason, nameof(reason), MaxReasonLength).Trim();
        return new TicketActivity(activityId, Id, TicketActivityKind.Deleted, Status, Status, DeleteReason);
    }

    public TicketActivity Restore(Guid activityId)
    {
        IsDeleted = false;
        DeleterId = null;
        DeletionTime = null;
        DeleteReason = null;
        return new TicketActivity(activityId, Id, TicketActivityKind.Restored, Status, Status);
    }

    private void AssignTo(Guid? assigneeId, DateTime now)
    {
        AssigneeId = assigneeId;
        AssignedAt = assigneeId.HasValue ? now : null;
        SlaStartAt = now;
        RecomputeDue();
    }

    private void RecomputeDue() =>
        DueAt = ProcessingDays.HasValue ? SlaStartAt.AddDays(ProcessingDays.Value) : null;

    private static string? Optional(string? value, string name, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : Check.Length(value.Trim(), name, max);
}
