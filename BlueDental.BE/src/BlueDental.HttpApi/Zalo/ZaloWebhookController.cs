using System.IO;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Zalo;

/// <summary>
/// Receiver for Zalo OA webhook events. Zalo only lets the webhook URL be
/// saved once it answers 200, so the GET probe always does; the POST hands the
/// raw body and Zalo's signature header to the handler, which verifies the
/// signature when the OA secret is configured and marks delivered messages.
/// </summary>
[RemoteService(IsEnabled = false)]
[AllowAnonymous]
[Route("api/v1/app/zalo/webhook")]
public sealed class ZaloWebhookController(IZaloWebhookHandler handler) : BlueDentalController
{
    [HttpGet]
    public IActionResult Probe() => Ok();

    [HttpPost]
    public async Task<IActionResult> ReceiveAsync()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var signature = Request.Headers["X-ZEvent-Signature"].ToString();
        var result = await handler.HandleAsync(body, string.IsNullOrWhiteSpace(signature) ? null : signature);

        return result == ZaloWebhookResult.Unauthorized ? Unauthorized() : Ok();
    }
}
