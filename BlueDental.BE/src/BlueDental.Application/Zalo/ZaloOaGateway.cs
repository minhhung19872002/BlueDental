using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.ClinicIntegration;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;

namespace BlueDental.Zalo;

/// <summary>
/// A branch's way to Zalo: its OA link, calls made with the link's token
/// (refreshed once when Zalo refuses it), and the integration call log every
/// call leaves. Shared by the Zalo OA tab and the CSKH message templates so
/// both read ZNS templates the same way. Permission checks stay with callers.
/// </summary>
public class ZaloOaGateway : ITransientDependency
{
    /// <summary>Zalo serves at most 100 templates per request.</summary>
    public const int MaxTemplatePage = 100;

    private const int MaxTemplatePages = 20;

    private readonly IRepository<ZaloOaConnection, Guid> _connections;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IZaloApiClient _zalo;
    private readonly ZaloOaTokenService _tokens;
    private readonly IGuidGenerator _guids;

    public ZaloOaGateway(
        IRepository<ZaloOaConnection, Guid> connections,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IZaloApiClient zalo,
        ZaloOaTokenService tokens,
        IGuidGenerator guids)
    {
        _connections = connections;
        _callLogs = callLogs;
        _zalo = zalo;
        _tokens = tokens;
        _guids = guids;
    }

    public Task<ZaloOaConnection?> FindConnectionAsync(Guid branchId) =>
        _connections.FirstOrDefaultAsync(c => c.ClinicBranchId == branchId);

    public async Task<ZaloOaConnection> GetConnectionAsync(Guid branchId) =>
        await FindConnectionAsync(branchId)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloNotConnected);

    public async Task<ZaloTemplateListOutcome> FetchTemplatePageAsync(
        Guid branchId, ZaloOaConnection connection, int offset, int limit, int? status)
    {
        var outcome = await CallWithTokenAsync(connection,
            token => _zalo.GetTemplatesAsync(token, offset, Math.Clamp(limit, 1, MaxTemplatePage), status),
            o => o.Call);
        await LogAsync(branchId, "template-list", outcome.Call, outcome.Items.Count);
        if (!outcome.Call.Succeeded)
        {
            throw Refused(outcome.Call);
        }

        return outcome;
    }

    /// <summary>Every template of the OA, page after page (capped at 2 000).</summary>
    public async Task<IReadOnlyList<ZaloTemplateSummary>> FetchAllTemplatesAsync(
        Guid branchId, ZaloOaConnection connection)
    {
        var all = new List<ZaloTemplateSummary>();
        for (var page = 0; page < MaxTemplatePages; page++)
        {
            var outcome = await FetchTemplatePageAsync(branchId, connection, all.Count, MaxTemplatePage, null);
            all.AddRange(outcome.Items);
            if (outcome.Items.Count < MaxTemplatePage || all.Count >= outcome.Total)
            {
                break;
            }
        }

        return all;
    }

    public async Task<ZaloTemplateDetail> FetchTemplateDetailAsync(
        Guid branchId, ZaloOaConnection connection, string templateId)
    {
        var outcome = await CallWithTokenAsync(connection,
            token => _zalo.GetTemplateDetailAsync(token, templateId),
            o => o.Call);
        await LogAsync(branchId, "template-info", outcome.Call);
        if (!outcome.Call.Succeeded || outcome.Detail == null)
        {
            throw Refused(outcome.Call);
        }

        return outcome.Detail;
    }

    /// <summary>
    /// Calls Zalo with the branch's access token. A token Zalo no longer
    /// honours before its stated expiry (a newer pair was issued elsewhere,
    /// the OA revoked the app) is refreshed once and the call repeated; a
    /// refused token means Zalo did nothing, so repeating a send is safe.
    /// </summary>
    public async Task<T> CallWithTokenAsync<T>(
        ZaloOaConnection connection, Func<string, Task<T>> call, Func<T, ZaloCallOutcome> outcomeOf)
    {
        var result = await call(await _tokens.GetAccessTokenAsync(connection));
        if (!IsInvalidToken(outcomeOf(result)) || !await _tokens.RefreshAsync(connection))
        {
            return result;
        }

        return await call(await _tokens.GetAccessTokenAsync(connection));
    }

    public Task LogAsync(Guid branchId, string operation, ZaloCallOutcome call, int itemCount = 0) =>
        _callLogs.InsertAsync(new IntegrationCallLog(
            _guids.Create(), branchId, operation, call.RequestPath,
            call.StatusCode, call.Succeeded, call.DurationMs, itemCount, call.Error));

    public static BusinessException Refused(ZaloCallOutcome call) =>
        new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloRequestFailed)
            .WithData("message", call.Error ?? "unknown");

    /// <summary>-124 on the Business (ZBS) API, -216 on the Open API: "access token invalid".</summary>
    private static bool IsInvalidToken(ZaloCallOutcome call) =>
        !call.Succeeded && call.ErrorCode is "-124" or "-216";
}
