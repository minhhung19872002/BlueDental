namespace BlueDental.CustomerCare;

/// <summary>A line of a care note's history: who wrote, changed or struck it, and when.</summary>
public enum CareNoteAction
{
    Created = 0,
    Edited = 1,
    Removed = 2,
}

/// <summary>
/// The fixed quick tags of "Kết quả cuộc gọi" (BA P2210: "Đã liên hệ/ không
/// bắt máy --> Tag có sẵn để note nhanh, fix cứng").
/// </summary>
public enum CareNoteOutcome
{
    /// <summary>"Đã liên hệ".</summary>
    Contacted = 1,

    /// <summary>"Không nghe máy".</summary>
    NoAnswer = 2,
}

public static class CareNoteConsts
{
    public const int MaxContentLength = 2000;
}
