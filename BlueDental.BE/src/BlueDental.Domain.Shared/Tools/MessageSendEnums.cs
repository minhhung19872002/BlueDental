namespace BlueDental.Tools;

// CSKH ▸ Gửi tin nhắn (BA P2110, F-77). Shared with the API contracts.

/// <summary>Where "Gửi tới" took the customers from.</summary>
public enum MessageRecipientSource : short
{
    /// <summary>"Danh sách CSKH" — one of the 10 CSKH tabs over a period.</summary>
    CareList = 0,

    /// <summary>"Khách lẻ" — customers picked one by one.</summary>
    Individual = 1,
}

public enum MessageSendBatchStatus : short
{
    /// <summary>Waiting for its time ("Hẹn giờ gửi") or for the job to pick it up.</summary>
    Queued = 0,

    Sending = 1,

    Completed = 2,

    /// <summary>A scheduled send called off before it started.</summary>
    Cancelled = 3,

    /// <summary>"Tạm dừng" while sending (BA P2210, F-79): what went stays sent, the rest never goes.</summary>
    Stopped = 4,
}

/// <summary>Why a customer of the list gets no message ("Kiểm tra trước khi gửi").</summary>
public enum MessageSkipReason : short
{
    /// <summary>No phone (SMS, Zalo) or e-mail address.</summary>
    NoContact = 1,

    /// <summary>Got this template within the last 30 days, with "Bỏ qua khách đã nhận" on.</summary>
    RecentlySent = 2,

    /// <summary>A variable the template needs has no value and no fallback.</summary>
    MissingVariable = 3,

    /// <summary>A phone that is not a Vietnamese mobile number (BA P2210 R12 "Sai định dạng số").</summary>
    InvalidPhone = 4,

    /// <summary>Shares its phone with another customer of the send, who gets the one message (R05 "Gộp trùng số").</summary>
    MergedPhone = 5,
}
