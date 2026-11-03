namespace BlueDental.TreatmentManagement;

/// <summary>What was done to a công đoạn. One row of its change log (BA 2026-11-02).</summary>
public enum TreatmentStageChangeAction
{
    NoteChanged = 1,
    RemarkChanged = 2,
    DetailsUpdated = 3,
    Completed = 4,
    Reverted = 5,
    ImageAdded = 6,
    ImageRemoved = 7,
    Deleted = 8,
    ServiceItemsUpdated = 9
}
