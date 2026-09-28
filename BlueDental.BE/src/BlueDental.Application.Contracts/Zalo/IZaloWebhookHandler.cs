using System.Threading.Tasks;

namespace BlueDental.Zalo;

public enum ZaloWebhookResult
{
    Accepted,
    Unauthorized,
}

/// <summary>
/// Processes one Zalo OA webhook event. Not an application service: it has no
/// user, no branch header and no permission; the branch comes from the
/// message the event refers to.
/// </summary>
public interface IZaloWebhookHandler
{
    Task<ZaloWebhookResult> HandleAsync(string body, string? signatureHeader);
}
