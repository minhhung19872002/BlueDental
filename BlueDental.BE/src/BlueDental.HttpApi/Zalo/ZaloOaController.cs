using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Zalo;

/// <summary>
/// The reference's <c>/zalo-oa</c>, <c>/zalo-oa-templates</c> and
/// <c>/zalo-oa-messages</c> resources, grouped under one prefix.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/zalo")]
public sealed class ZaloOaController(IZaloOaAppService service) : BlueDentalController
{
    [HttpGet("status")]
    public Task<ZaloOaStatusDto> GetStatusAsync() => service.GetStatusAsync();

    [HttpGet("connect-url")]
    public Task<ZaloConnectUrlDto> GetConnectUrlAsync() => service.GetConnectUrlAsync();

    /// <summary>Zalo lands here after consent; the browser is sent on to the tab.</summary>
    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallbackAsync(
        [FromQuery] string? code, [FromQuery] string? state, [FromQuery(Name = "oa_id")] string? oaId)
    {
        var result = await service.HandleCallbackAsync(code, state, oaId);
        return Redirect(result.RedirectUrl);
    }

    [HttpPost("bootstrap-import")]
    public Task<ZaloOaStatusDto> ImportBootstrapAsync() => service.ImportBootstrapAsync();

    [HttpPut("enabled")]
    public Task<ZaloOaStatusDto> SetEnabledAsync([FromBody] SetZaloEnabledInput input) => service.SetEnabledAsync(input);

    [HttpDelete("connection")]
    public Task DisconnectAsync() => service.DisconnectAsync();

    [HttpPost("refresh-token")]
    public Task<ZaloOaStatusDto> RefreshTokenAsync() => service.RefreshTokenAsync();

    [HttpGet("templates")]
    public Task<PagedResultDto<ZaloTemplateDto>> GetTemplatesAsync([FromQuery] GetZaloTemplatesInput input) =>
        service.GetTemplatesAsync(input);

    [HttpGet("templates/{templateId}")]
    public Task<ZaloTemplateDetailDto> GetTemplateDetailAsync(string templateId) =>
        service.GetTemplateDetailAsync(templateId);

    [HttpPost("messages")]
    public Task<ZaloMessageDto> SendAsync([FromBody] SendZaloMessageInput input) => service.SendAsync(input);

    [HttpGet("messages")]
    public Task<PagedResultDto<ZaloMessageDto>> GetMessagesAsync([FromQuery] GetZaloMessagesInput input) =>
        service.GetMessagesAsync(input);

    [HttpGet("messages/stats")]
    public Task<ZaloMessageStatsDto> GetMessageStatsAsync() => service.GetMessageStatsAsync();
}
