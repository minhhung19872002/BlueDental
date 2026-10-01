using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlueDental.Zalo;

/// <summary>
/// Receiver for Zalo OA webhook events. Zalo only lets the webhook URL be
/// saved once it answers 200, so both GET and POST always do; the POST hands the
/// raw body and Zalo's signature header to the handler, which drops anything
/// whose signature does not verify and marks delivered messages.
/// </summary>
[AllowAnonymous]
[ApiController]
[Route("api/v1/app/zalo/webhook")]
public sealed class ZaloWebhookController(IZaloWebhookHandler handler) : ControllerBase
{
    [HttpGet]
    public IActionResult Probe() => Ok();

    [HttpPost]
    public async Task<IActionResult> ReceiveAsync()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        var signature = Request.Headers["X-ZEvent-Signature"].ToString();
        await handler.HandleAsync(body, string.IsNullOrWhiteSpace(signature) ? null : signature);

        // Always 200: Zalo's "Kiểm tra" check may POST without a valid signature,
        // and a non-200 marks the webhook broken. Unverified events are already
        // dropped by the handler, so answering 200 changes nothing for it.
        return Ok();
    }
}
