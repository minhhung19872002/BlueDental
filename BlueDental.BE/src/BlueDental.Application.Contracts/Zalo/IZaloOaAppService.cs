using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Zalo;

/// <summary>
/// The Zalo OA tab of Công cụ: one OA link per branch, ZBS templates read
/// straight from Zalo, and the ZNS messages the branch sent.
/// </summary>
public interface IZaloOaAppService : IApplicationService
{
    Task<ZaloOaStatusDto> GetStatusAsync();

    /// <summary>The Zalo consent URL for the current branch; the browser is sent there.</summary>
    Task<ZaloConnectUrlDto> GetConnectUrlAsync();

    /// <summary>Zalo's redirect back. Anonymous: the signed <paramref name="state"/> names the branch.</summary>
    Task<ZaloOAuthCallbackResultDto> HandleCallbackAsync(string? code, string? state, string? oaId);

    /// <summary>Links the branch with the token pair configured on the server, skipping OAuth.</summary>
    Task<ZaloOaStatusDto> ImportBootstrapAsync();

    Task<ZaloOaStatusDto> SetEnabledAsync(SetZaloEnabledInput input);

    Task DisconnectAsync();

    Task<ZaloOaStatusDto> RefreshTokenAsync();

    Task<PagedResultDto<ZaloTemplateDto>> GetTemplatesAsync(GetZaloTemplatesInput input);

    Task<ZaloTemplateDetailDto> GetTemplateDetailAsync(string templateId);

    Task<ZaloMessageDto> SendAsync(SendZaloMessageInput input);

    Task<PagedResultDto<ZaloMessageDto>> GetMessagesAsync(GetZaloMessagesInput input);

    Task<ZaloMessageStatsDto> GetMessageStatsAsync();
}
