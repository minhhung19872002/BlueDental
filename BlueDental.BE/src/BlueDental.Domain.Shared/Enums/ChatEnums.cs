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

public static class ChatConsts
{
    public const int MaxGroupNameLength = 100;

    public const int MaxMessageLength = 4000;

    public const int MaxAttachmentsPerMessage = 10;

    /// <summary>20 MB, the same cap as Hình ảnh bệnh nhân (R-1065).</summary>
    public const long MaxAttachmentBytes = 20L * 1024 * 1024;

    public const int MaxFileNameLength = 255;

    public const int MaxGroupMembers = 100;

    public const int DefaultMessagePageSize = 30;

    public const int MaxMessagePageSize = 100;
}
