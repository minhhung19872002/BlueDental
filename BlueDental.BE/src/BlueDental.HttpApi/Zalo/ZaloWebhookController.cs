using System.Text.Json;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Volo.Abp;

namespace BlueDental.Zalo;

/// <summary>
/// Receiver for Zalo OA webhook events. Zalo only lets the webhook URL be saved
/// once it answers 200, so this endpoint exists before the event handling does:
/// it acknowledges every call and logs the event name. Signature verification
/// and event processing follow with the Zalo OA integration.
/// </summary>
[RemoteService(IsEnabled = false)]
[AllowAnonymous]
[Route("api/v1/app/zalo/webhook")]
public sealed class ZaloWebhookController(ILogger<ZaloWebhookController> logger) : BlueDentalController
{
    [HttpGet]
    public IActionResult Probe() => Ok();

    [HttpPost]
    public async Task<IActionResult> ReceiveAsync()
    {
        using var reader = new System.IO.StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var eventName = TryReadEventName(body);
        logger.LogInformation("Zalo webhook received: {EventName}", eventName ?? "<unknown>");

        return Ok();
    }

    /// <summary>Only the event name is logged; the payload carries user data.</summary>
    private static string? TryReadEventName(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("event_name", out var name) ? name.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
