namespace BlueDental.Visits;

/// <summary>
/// What reception recorded at the end of a visit.
///
/// The reception screen has offered these four choices for a while, but nothing
/// behind them: the frontend sent an "outcome" field on the update endpoint,
/// which UpdateVisitDto never declared, so it was dropped before it reached the
/// domain — and the update itself is refused once a visit leaves Scheduled,
/// which every visit being closed already has.
///
/// Values are explicit so the stored number keeps its meaning if the list is
/// reordered later.
/// </summary>
public enum VisitOutcome : short
{
    /// <summary>Treatment finished; no further appointment expected.</summary>
    EndTreatment = 1,

    /// <summary>The next appointment has already been booked.</summary>
    FollowUp = 2,

    /// <summary>Handed to another dentist.</summary>
    TransferDoctor = 3,

    /// <summary>The patient is expected back, without a booking yet.</summary>
    Revisit = 4,
}
