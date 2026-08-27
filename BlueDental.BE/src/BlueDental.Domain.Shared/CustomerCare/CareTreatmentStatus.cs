namespace BlueDental.CustomerCare;

/// <summary>
/// Trạng thái điều trị of a patient on the Phân nhóm CSKH tab.
///
/// Wire values (staging <c>GET /patients</c>): <c>created</c> = Chưa phát sinh,
/// <c>in-progress</c> = Đang điều trị, <c>done</c> = Hoàn tất.
/// </summary>
public enum CareTreatmentStatus : short
{
    /// <summary>Chưa phát sinh — no treatment plan yet (<c>created</c>).</summary>
    Created = 1,

    /// <summary>Đang điều trị (<c>in-progress</c>).</summary>
    InProgress = 2,

    /// <summary>Hoàn tất (<c>done</c>).</summary>
    Done = 3
}
