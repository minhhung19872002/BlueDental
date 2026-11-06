namespace BlueDental.Chat;

/// <summary>Chat nội bộ (F-89) knobs from the "Chat" configuration section (R-1158).</summary>
public class ChatOptions
{
    public const string SectionName = "Chat";

    /// <summary>A file uploaded but never sent is deleted once it is this old.</summary>
    public int OrphanAttachmentHours { get; set; } = 24;

    /// <summary>How often the orphan sweep runs.</summary>
    public int OrphanSweepSeconds { get; set; } = 60 * 60;

    public ChatRateLimitOptions RateLimit { get; set; } = new();
}

/// <summary>
/// Per-account sliding window on sending and uploading, so one account (or a
/// stolen session) cannot flood a thread or the file store. In-memory, which
/// fits the single API container; several hosts would each count on their own.
/// </summary>
public class ChatRateLimitOptions
{
    public int WindowSeconds { get; set; } = 30;

    public int SendPermits { get; set; } = 30;

    public int UploadPermits { get; set; } = 30;

    public int SearchPermits { get; set; } = 20;
}
