namespace BlueDental.ZaloInbox;

/// <summary>The two states BA P2210 gives a conversation of Hộp thư Zalo.</summary>
public enum ZaloConversationStatus
{
    /// <summary>"Chưa trả lời": the customer's last message has no answer after it.</summary>
    Unreplied = 0,

    /// <summary>"Đã chăm sóc": the OA answered after the customer's last message.</summary>
    Cared = 1,
}

public enum ZaloChatDirection
{
    /// <summary>Customer → OA.</summary>
    Inbound = 0,

    /// <summary>OA → customer, from BlueDental or from Zalo's own OA chat.</summary>
    Outbound = 1,
}

/// <summary>What Zalo says a message is: the webhook's <c>user_send_*</c> / <c>oa_send_*</c> suffix, the history's <c>type</c>.</summary>
public enum ZaloChatKind
{
    Text = 0,
    Image = 1,
    Sticker = 2,
    File = 3,
    Link = 4,
    Audio = 5,
    Video = 6,
    Location = 7,
    Other = 9,
}

public static class ZaloInboxConsts
{
    /// <summary>Zalo's limit on a text "tin tư vấn"; BA P2210 shows "0/2.000 ký tự".</summary>
    public const int MaxMessageLength = 2000;

    public const int MaxNoteLength = 2000;

    public const int MaxTagLength = 30;

    public const int MaxTags = 10;

    /// <summary>BA P2210: "Nếu sau 15p mà không trả lời khách hàng thì tự động clear user".</summary>
    public const int HoldMinutes = 15;

    /// <summary>Zalo: a "tin tư vấn" goes only within 48 hours of the customer's last interaction.</summary>
    public const int ReplyWindowHours = 48;
}
