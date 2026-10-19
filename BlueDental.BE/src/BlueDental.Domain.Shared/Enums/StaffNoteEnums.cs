namespace BlueDental.StaffNotes;

/// <summary>
/// Which list of the header's "Thêm ghi chú" dialog a note sits in (F-74,
/// BlueDental-local: the reference has no notes tool).
/// </summary>
public enum StaffNoteScope : short
{
    /// <summary>Chung — read by every staff member of the note's branch.</summary>
    Shared = 1,

    /// <summary>Cá nhân — read by its author only, whatever branch they work in.</summary>
    Personal = 2,
}

public static class StaffNoteConsts
{
    public const int MaxContentLength = 2000;
}
