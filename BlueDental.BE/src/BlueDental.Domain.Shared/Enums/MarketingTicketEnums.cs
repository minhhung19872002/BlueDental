namespace BlueDental.Marketing;

/// <summary>
/// Where a Marketing ticket (a lead) stands. BlueDental-local: the reference has
/// no ticket screen (docs/clone/pages/marketing-ticket.md, BA PDF items 8.1–8.7).
///
/// Đã đặt hẹn and Đã đến are never set by hand: booking from the ticket sets the
/// first, the linked appointment's check-in sets the second.
/// </summary>
public enum TicketStatus : short
{
    /// <summary>Mới — nobody has reached the customer yet.</summary>
    New = 1,

    /// <summary>Đang chăm sóc — at least one contact recorded.</summary>
    InCare = 2,

    /// <summary>Đã đặt hẹn — an appointment was booked from the ticket.</summary>
    Booked = 3,

    /// <summary>Đã đến — the booked appointment was checked in. The goal.</summary>
    Arrived = 4,

    /// <summary>Không tiềm năng — closed by hand, with a reason; can be reopened.</summary>
    NotPotential = 5
}

/// <summary>How the ticket came in.</summary>
public enum TicketChannel : short
{
    /// <summary>Typed in on the Ticket screen.</summary>
    Manual = 1,

    /// <summary>Imported from an Excel file (phase 2).</summary>
    File = 2,

    /// <summary>Posted by the clinic's website form (phase 3).</summary>
    Website = 3
}

/// <summary>Kết quả liên hệ of one call or message.</summary>
public enum TicketContactResult : short
{
    /// <summary>Quan tâm.</summary>
    Interested = 1,

    /// <summary>Chưa có nhu cầu.</summary>
    NoNeed = 2,

    /// <summary>Không nghe máy.</summary>
    NoAnswer = 3,

    /// <summary>Sai số / thuê bao.</summary>
    Unreachable = 4,

    /// <summary>Hẹn gọi lại — carries the time to call back.</summary>
    CallBack = 5
}

/// <summary>What one line of the ticket's timeline records.</summary>
public enum TicketActivityKind : short
{
    Created = 1,
    Contact = 2,
    StatusChanged = 3,
    Assigned = 4,

    /// <summary>Phát sinh lại — the same phone came in again while the ticket was open.</summary>
    Reoccurred = 5,

    /// <summary>An appointment was booked from the ticket.</summary>
    Booked = 6,

    /// <summary>The linked appointment was checked in, cancelled or missed.</summary>
    AppointmentChanged = 7,

    Deleted = 8,
    Restored = 9
}
