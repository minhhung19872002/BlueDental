namespace BlueDental.Chat;

/// <summary>
/// Rate-limiter policy names for Chat nội bộ (R-1158). The policies themselves
/// are registered by the host from <c>Chat:RateLimit</c>; each counts per account.
/// </summary>
public static class ChatRateLimitPolicies
{
    public const string Send = "chat-send";

    public const string Upload = "chat-upload";

    /// <summary>A search opens up to 5,000 sealed messages, so it is counted too.</summary>
    public const string Search = "chat-search";
}
