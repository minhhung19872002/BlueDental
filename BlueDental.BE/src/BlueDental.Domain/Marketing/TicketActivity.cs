using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Marketing;

/// <summary>
/// One line of a ticket's timeline: who did what, when (the creation audit).
/// Never edited, never deleted — the history is the point.
///
/// Kept as its own entity rather than a child collection of <see cref="Ticket"/>:
/// a ticket gathers lines for months, and every write would otherwise load them all.
/// </summary>
public class TicketActivity : CreationAuditedEntity<Guid>
{
    public Guid TicketId { get; private set; }

    public TicketActivityKind Kind { get; private set; }

    /// <summary>Set on a <see cref="TicketActivityKind.Contact"/> line.</summary>
    public TicketContactResult? ContactResult { get; private set; }

    /// <summary>Set, with <see cref="ToStatus"/>, whenever the line moved the ticket.</summary>
    public TicketStatus? FromStatus { get; private set; }

    public TicketStatus? ToStatus { get; private set; }

    public string? Note { get; private set; }

    public DateTime? NextCallAt { get; private set; }

    /// <summary>On an <see cref="TicketActivityKind.Assigned"/> line: the new owner, null = the pool.</summary>
    public Guid? AssigneeId { get; private set; }

    public Guid? AppointmentId { get; private set; }

    protected TicketActivity() { }

    internal TicketActivity(
        Guid id,
        Guid ticketId,
        TicketActivityKind kind,
        TicketStatus from,
        TicketStatus to,
        string? note = null)
        : base(id)
    {
        TicketId = ticketId;
        Kind = kind;
        Note = note;
        if (from != to || kind == TicketActivityKind.Created)
        {
            FromStatus = kind == TicketActivityKind.Created ? null : from;
            ToStatus = to;
        }
    }

    internal TicketActivity WithContact(TicketContactResult result, DateTime? nextCallAt)
    {
        ContactResult = result;
        NextCallAt = nextCallAt;
        return this;
    }

    internal TicketActivity WithAssignee(Guid? assigneeId)
    {
        AssigneeId = assigneeId;
        return this;
    }

    internal TicketActivity WithAppointment(Guid appointmentId)
    {
        AppointmentId = appointmentId;
        return this;
    }
}
