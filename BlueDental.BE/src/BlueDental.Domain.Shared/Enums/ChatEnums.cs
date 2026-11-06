namespace BlueDental.Chat;

/// <summary>
/// Chat nội bộ (F-89, BlueDental-local: the reference has no staff chat).
/// </summary>
public enum ChatConversationKind : short
{
    /// <summary>Two people; one conversation per pair and branch.</summary>
    Direct = 1,

    /// <summary>A named group anyone may start and anyone in it may grow.</summary>
    Group = 2,
}

/// <summary>Which shelf of Kho lưu trữ (R-1160) a file sits on.</summary>
public enum ChatSharedFileKind : short
{
    /// <summary>Pictures (chat takes no video yet).</summary>
    Media = 1,

    /// <summary>Every other file.</summary>
    File = 2,
}

public static class ChatConsts
{
    public const int MaxGroupNameLength = 100;

    public const int MaxMessageLength = 4000;

    public const int MaxAttachmentsPerMessage = 10;

    /// <summary>50 MB (owner 2026-11-06, R-1158); Hình ảnh bệnh nhân stays at 20 MB (R-1065).</summary>
    public const long MaxAttachmentBytes = 50L * 1024 * 1024;

    public const int MaxFileNameLength = 255;

    public const int MaxGroupMembers = 100;

    public const int DefaultMessagePageSize = 30;

    public const int MaxMessagePageSize = 100;

    /// <summary>A search reads at most this many of the newest messages (they are encrypted, R-1158).</summary>
    public const int MaxSearchScan = 5000;

    public const int MaxSearchResults = 50;

    public const int MaxSearchTextLength = 100;

    /// <summary>Only the sender may edit, and only this long after sending (owner 2026-11-06, R-1159).</summary>
    public const int EditWindowMinutes = 15;

    /// <summary>Kho lưu trữ (R-1160): files per page.</summary>
    public const int DefaultSharedFilePageSize = 60;

    public const int MaxSharedFilePageSize = 100;

    /// <summary>Kho lưu trữ links: at most this many, newest first, from the newest <see cref="MaxSearchScan"/> messages.</summary>
    public const int MaxSharedLinks = 200;

    public const int MaxLinkLength = 2000;

    /// <summary>Patients one message may tag with # (owner 2026-11-06, R-1161).</summary>
    public const int MaxPatientsPerMessage = 5;

    /// <summary>Rows the # list offers at once (R-1161).</summary>
    public const int MaxPatientSuggestions = 10;

    public const int MaxPatientSuggestionTextLength = 50;

    /// <summary>
    /// What a send or an edit may carry: the text the reader sees plus the
    /// "[…](patient:{id})" part of each # tag around it (R-1161).
    /// </summary>
    public const int MaxMessageInputLength = MaxMessageLength + MaxPatientsPerMessage * 64;
}

/// <summary>
/// Where a tagged patient's day stands (R-1161), read from their appointment
/// at the conversation's branch today. Same wording as the Tiếp nhận board.
/// </summary>
public enum ChatPatientVisitStatus : short
{
    /// <summary>Đã hẹn: booked, not here yet, time not passed.</summary>
    Scheduled = 1,

    /// <summary>Trễ hẹn: booked time passed without check-in, or marked no-show.</summary>
    Late = 2,

    /// <summary>Đã đến: checked in, waiting.</summary>
    Arrived = 3,

    /// <summary>Đang khám.</summary>
    InTreatment = 4,

    /// <summary>Hoàn tất.</summary>
    Completed = 5,

    /// <summary>Hủy hẹn.</summary>
    Cancelled = 6,
}
