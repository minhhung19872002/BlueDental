using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.ClinicIntegration;
using BlueDental.CustomerCare;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Uow;

namespace BlueDental.Zalo;

/// <summary>
/// The Zalo OA tab: one OA link per branch (OAuth consent or the portal
/// token pair), ZBS templates read from Zalo on demand, ZNS sends recorded
/// as <see cref="MessageLog"/> rows on the Zalo channel.
/// </summary>
[Authorize]
public class ZaloOaAppService : BlueDentalAppService, IZaloOaAppService
{
    public const string CallbackPath = "/api/v1/app/zalo/oauth/callback";
    public const string ReturnPath = "/tools/zalo-oa";

    private const int MaxContentLength = 2000;
    private const int MaxRedirectMessage = 200;
    private const int MaxTemplatePage = 100;
    private const string ClinicTimeZoneId = "SE Asia Standard Time";

    private readonly IRepository<ZaloOaConnection, Guid> _connections;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IRepository<MessageLog, Guid> _messages;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<CareRecord, Guid> _careRecords;
    private readonly IRepository<ClinicBranch, Guid> _branches;
    private readonly IRepository<Appointment, Guid> _appointments;
    private readonly IIdentityUserRepository _users;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IZaloApiClient _zalo;
    private readonly ZaloOaTokenService _tokens;
    private readonly IOptions<ZaloOptions> _options;
    private readonly IConfiguration _configuration;

    public ZaloOaAppService(
        IRepository<ZaloOaConnection, Guid> connections,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IRepository<MessageLog, Guid> messages,
        IRepository<Patient, Guid> patients,
        IRepository<CareRecord, Guid> careRecords,
        IRepository<ClinicBranch, Guid> branches,
        IRepository<Appointment, Guid> appointments,
        IIdentityUserRepository users,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess,
        IZaloApiClient zalo,
        ZaloOaTokenService tokens,
        IOptions<ZaloOptions> options,
        IConfiguration configuration)
    {
        _connections = connections;
        _callLogs = callLogs;
        _messages = messages;
        _patients = patients;
        _careRecords = careRecords;
        _branches = branches;
        _appointments = appointments;
        _users = users;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
        _zalo = zalo;
        _tokens = tokens;
        _options = options;
        _configuration = configuration;
    }

    private ZaloOptions Options => _options.Value;

    // ── Connection ────────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<ZaloOaStatusDto> GetStatusAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        return ToStatus(branchId, await FindConnectionAsync(branchId));
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public Task<ZaloConnectUrlDto> GetConnectUrlAsync()
    {
        EnsureConfigured();
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var state = ZaloOAuthState.Create(branchId, Clock.Now, Options.AppSecret);

        var url = Options.OAuthBaseUrl.TrimEnd('/')
            + "/v4/oa/permission?app_id=" + Uri.EscapeDataString(Options.AppId)
            + "&redirect_uri=" + Uri.EscapeDataString(CallbackUrl)
            + "&state=" + Uri.EscapeDataString(state);

        return Task.FromResult(new ZaloConnectUrlDto { Url = url });
    }

    /// <summary>
    /// Zalo's redirect. No user session here: the signed state names the
    /// branch, and the outcome travels back to the tab as a query flag.
    /// </summary>
    [AllowAnonymous]
    public async Task<ZaloOAuthCallbackResultDto> HandleCallbackAsync(string? code, string? state, string? oaId)
    {
        if (!Options.HasAppCredentials)
        {
            return Redirect("error", "not-configured");
        }

        var branchId = ZaloOAuthState.Read(state, Clock.Now, Options.AppSecret);
        if (branchId == null)
        {
            return Redirect("error", "state");
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            return Redirect("error", "denied");
        }

        var exchange = await _zalo.ExchangeCodeAsync(code);
        await LogAsync(branchId.Value, "oauth-exchange", exchange.Call);
        if (!exchange.Call.Succeeded || exchange.AccessToken == null || exchange.RefreshToken == null)
        {
            return Redirect("error", "exchange", exchange.Call.Error);
        }

        var info = await _zalo.GetOaInfoAsync(exchange.AccessToken);
        await LogAsync(branchId.Value, "oa-info", info.Call);
        if (!info.Call.Succeeded || info.Info == null)
        {
            return Redirect("error", "oa-info", info.Call.Error);
        }

        if (!OaMatches(info.Info.OaId, oaId))
        {
            return Redirect("error", "oa-mismatch");
        }

        var now = Clock.Now;
        var tokens = _tokens.Encrypt(exchange.AccessToken, exchange.RefreshToken, exchange.ExpiresInSeconds, now);
        await UpsertConnectionAsync(branchId.Value, info.Info, tokens, now);

        return Redirect("connected", null);
    }

    /// <summary>
    /// Links the branch with the token pair pasted from the Zalo portal, for
    /// setups where the OAuth round trip is not possible. The pair's own
    /// expiry is unknown, so the access token is treated as short-lived and
    /// renewed on first use.
    /// </summary>
    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<ZaloOaStatusDto> ImportBootstrapAsync()
    {
        if (!Options.HasBootstrapTokens)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloNotConfigured);
        }

        var branchId = _branchResolver.GetRequiredClinicBranchId();

        var accessToken = Options.BootstrapAccessToken;
        var refreshToken = Options.BootstrapRefreshToken;

        var info = await _zalo.GetOaInfoAsync(accessToken);
        await LogAsync(branchId, "oa-info", info.Call);

        if (!info.Call.Succeeded || info.Info == null)
        {
            var refreshResult = await _zalo.RefreshTokenAsync(refreshToken);
            await LogAsync(branchId, "bootstrap-refresh", refreshResult.Call);

            if (!refreshResult.Call.Succeeded || refreshResult.AccessToken == null || refreshResult.RefreshToken == null)
            {
                throw Refused(refreshResult.Call);
            }

            accessToken = refreshResult.AccessToken;
            refreshToken = refreshResult.RefreshToken;

            info = await _zalo.GetOaInfoAsync(accessToken);
            await LogAsync(branchId, "oa-info-retry", info.Call);
            if (!info.Call.Succeeded || info.Info == null)
            {
                throw Refused(info.Call);
            }
        }

        if (!OaMatches(info.Info.OaId, null))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloOaMismatch);
        }

        var now = Clock.Now;
        var tokens = _tokens.Encrypt(
            accessToken, refreshToken, (int)TimeSpan.FromHours(1).TotalSeconds, now);
        var connection = await UpsertConnectionAsync(branchId, info.Info, tokens, now);

        return ToStatus(branchId, connection);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<ZaloOaStatusDto> SetEnabledAsync(SetZaloEnabledInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await GetConnectionAsync(branchId);

        connection.SetEnabled(input.IsEnabled);
        await _connections.UpdateAsync(connection);

        return ToStatus(branchId, connection);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DisconnectAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await FindConnectionAsync(branchId);
        if (connection != null)
        {
            await _connections.DeleteAsync(connection);
        }
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<ZaloOaStatusDto> RefreshTokenAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await GetConnectionAsync(branchId);

        await _tokens.RefreshAsync(connection);

        return ToStatus(branchId, connection);
    }

    // ── Templates ─────────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<ZaloTemplateDto>> GetTemplatesAsync(GetZaloTemplatesInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await GetConnectionAsync(branchId);

        // Zalo serves at most 100 templates per request.
        var limit = Math.Clamp(input.MaxResultCount, 1, MaxTemplatePage);
        var outcome = await CallWithTokenAsync(connection,
            token => _zalo.GetTemplatesAsync(token, input.SkipCount, limit, input.Status),
            o => o.Call);
        await LogAsync(branchId, "template-list", outcome.Call, outcome.Items.Count);
        if (!outcome.Call.Succeeded)
        {
            throw Refused(outcome.Call);
        }

        var items = outcome.Items.Select(ToTemplateDto).ToList();
        return new PagedResultDto<ZaloTemplateDto>(outcome.Total, items);
    }

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<ZaloTemplateDetailDto> GetTemplateDetailAsync(string templateId)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await GetConnectionAsync(branchId);

        var detail = await FetchTemplateDetailAsync(branchId, connection, templateId);
        return ToTemplateDetailDto(detail);
    }

    // ── Messages ──────────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<ZaloMessageDto> SendAsync(SendZaloMessageInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var connection = await GetConnectionAsync(branchId);
        connection.EnsureCanSend();

        var (patient, careRecord) = await ResolveRecipientAsync(input, branchId);
        var phone = ZaloPhoneNumber.Normalize(
            string.IsNullOrWhiteSpace(input.Phone) ? patient?.Contact.PhoneNumber : input.Phone);

        var detail = await FetchTemplateDetailAsync(branchId, connection, input.TemplateId);

        var branch = await _branches.FindAsync(branchId);
        var visit = await ResolveVisitAsync(careRecord);
        var data = ZaloTemplateDataBuilder.Build(
            detail.Params, KnownValues(patient, careRecord, branch, phone, visit), input.TemplateData);
        if (data.MissingRequired.Count > 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloTemplateDataMissing)
                .WithData("params", string.Join(", ", data.MissingRequired));
        }

        var messageId = GuidGenerator.Create();
        var message = new MessageLog(
            messageId, branchId, patient?.Id, null,
            patient?.FullName ?? phone, phone,
            DescribeContent(detail, data.Values), MessageChannelType.Zalo,
            MessageSendStatus.Pending, null, null)
            .SetExternalTemplate(detail.TemplateId, detail.Name);

        var outcome = await CallWithTokenAsync(connection,
            token => _zalo.SendTemplateMessageAsync(token, phone, detail.TemplateId, data.Values, messageId.ToString("N")),
            o => o.Call);

        if (!outcome.Call.Succeeded)
        {
            message.MarkFailed(outcome.Call.Error);
            await PersistSendAsync(branchId, message, outcome.Call, 0);
            throw Refused(outcome.Call);
        }

        message.MarkSent(outcome.MessageId, Clock.Now, detail.Price);
        await PersistSendAsync(branchId, message, outcome.Call, 1);

        if (careRecord != null)
        {
            careRecord.MarkZaloSent();
            await _careRecords.UpdateAsync(careRecord);
        }

        return ToMessageDto(message);
    }

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<ZaloMessageDto>> GetMessagesAsync(GetZaloMessagesInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var q = (await _messages.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId && x.Channel == MessageChannelType.Zalo);

        if (input.Status.HasValue)
        {
            q = q.Where(x => (int)x.Status == input.Status.Value);
        }

        if (input.Succeeded == true)
        {
            q = q.Where(x => x.Status == MessageSendStatus.Sent || x.Status == MessageSendStatus.Delivered);
        }
        else if (input.Succeeded == false)
        {
            q = q.Where(x => x.Status == MessageSendStatus.Failed);
        }

        if (input.DateFrom.HasValue)
        {
            q = q.Where(x => x.CreationTime >= input.DateFrom.Value);
        }

        if (input.DateTo.HasValue)
        {
            q = q.Where(x => x.CreationTime <= input.DateTo.Value);
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            q = q.Where(x => x.RecipientName.ToLower().Contains(term)
                || x.RecipientPhone.ToLower().Contains(term)
                || x.Content.ToLower().Contains(term));
        }

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<ZaloMessageDto>(totalCount, items.Select(ToMessageDto).ToList());
    }

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<ZaloMessageStatsDto> GetMessageStatsAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var q = (await _messages.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId && x.Channel == MessageChannelType.Zalo);

        var counts = q.GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToList();

        int Count(params MessageSendStatus[] statuses) =>
            counts.Where(c => statuses.Contains(c.Status)).Sum(c => c.Count);

        return new ZaloMessageStatsDto
        {
            Total = counts.Sum(c => c.Count),
            Success = Count(MessageSendStatus.Sent, MessageSendStatus.Delivered),
            Failed = Count(MessageSendStatus.Failed),
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private string SelfUrl =>
        (_configuration["App:SelfUrl"] ?? string.Empty).TrimEnd('/');

    private string CallbackUrl =>
        string.IsNullOrWhiteSpace(Options.CallbackUrl) ? SelfUrl + CallbackPath : Options.CallbackUrl;

    private string ReturnUrl =>
        string.IsNullOrWhiteSpace(Options.ReturnUrl) ? SelfUrl + ReturnPath : Options.ReturnUrl;

    private void EnsureConfigured()
    {
        if (!Options.HasAppCredentials)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloNotConfigured);
        }
    }

    /// <summary>
    /// The OA must be the one registered for the system when one is; and when
    /// Zalo names an OA on the callback it must be the one the token belongs to.
    /// </summary>
    private bool OaMatches(string grantedOaId, string? callbackOaId)
    {
        if (!string.IsNullOrWhiteSpace(Options.OaId) && Options.OaId != grantedOaId)
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(callbackOaId) || callbackOaId == grantedOaId;
    }

    private async Task<ZaloOaConnection> UpsertConnectionAsync(
        Guid branchId, ZaloOaInfo info, ZaloTokenSet tokens, DateTime now)
    {
        var connection = await FindConnectionAsync(branchId);
        if (connection == null)
        {
            connection = new ZaloOaConnection(GuidGenerator.Create(), branchId, info.OaId, info.Name, tokens, now);
            connection.SetOaInfo(info.OaId, info.Name, info.AvatarUrl, info.PackageName);
            await _connections.InsertAsync(connection, autoSave: true);
        }
        else
        {
            connection.SetOaInfo(info.OaId, info.Name, info.AvatarUrl, info.PackageName);
            connection.ReplaceTokens(tokens, now);
            await _connections.UpdateAsync(connection, autoSave: true);
        }

        return connection;
    }

    private Task<ZaloOaConnection?> FindConnectionAsync(Guid branchId) =>
        _connections.FirstOrDefaultAsync(c => c.ClinicBranchId == branchId);

    private async Task<ZaloOaConnection> GetConnectionAsync(Guid branchId) =>
        await FindConnectionAsync(branchId)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloNotConnected);

    private async Task<ZaloTemplateDetail> FetchTemplateDetailAsync(Guid branchId, ZaloOaConnection connection, string templateId)
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
    private async Task<T> CallWithTokenAsync<T>(
        ZaloOaConnection connection, Func<string, Task<T>> call, Func<T, ZaloCallOutcome> outcomeOf)
    {
        var result = await call(await _tokens.GetAccessTokenAsync(connection));
        if (!IsInvalidToken(outcomeOf(result)) || !await _tokens.RefreshAsync(connection))
        {
            return result;
        }

        return await call(await _tokens.GetAccessTokenAsync(connection));
    }

    /// <summary>-124 on the Business (ZBS) API, -216 on the Open API: "access token invalid".</summary>
    private static bool IsInvalidToken(ZaloCallOutcome call) =>
        !call.Succeeded && call.ErrorCode is "-124" or "-216";

    /// <summary>
    /// The send goes out through the current branch's OA and is logged there,
    /// so a record or patient of another branch is treated as not found.
    /// </summary>
    private async Task<(Patient? Patient, CareRecord? CareRecord)> ResolveRecipientAsync(
        SendZaloMessageInput input, Guid branchId)
    {
        CareRecord? careRecord = null;
        if (input.CareRecordId.HasValue)
        {
            careRecord = await _careRecords.GetAsync(input.CareRecordId.Value);
            await _branchAccess.CheckAsync(careRecord.BranchId);
            if (careRecord.BranchId != branchId)
            {
                throw new EntityNotFoundException(typeof(CareRecord), careRecord.Id);
            }
        }

        var patientId = input.PatientId ?? careRecord?.PatientId;
        if (patientId == null)
        {
            return (null, careRecord);
        }

        var patient = await _patients.GetAsync(patientId.Value);
        await _branchAccess.CheckAsync(patient.BranchId);
        // A care record already fixes the branch; its patient may have been registered elsewhere.
        if (input.PatientId.HasValue && patient.BranchId != branchId)
        {
            throw new EntityNotFoundException(typeof(Patient), patient.Id);
        }

        return (patient, careRecord);
    }

    /// <summary>
    /// The moment a template's date/time speak of: the linked appointment's
    /// slot for a reminder, else the care record's own schedule or due date.
    /// Only a record with none of these falls back to the send time.
    /// </summary>
    private async Task<(DateTimeOffset? When, string? DoctorName)> ResolveVisitAsync(CareRecord? careRecord)
    {
        if (careRecord == null)
        {
            return (null, null);
        }

        if (careRecord.AppointmentId.HasValue)
        {
            var appointment = await _appointments.FindAsync(careRecord.AppointmentId.Value);
            if (appointment != null)
            {
                var dentist = await _users.FindAsync(appointment.DentistId);
                return (appointment.Slot.Start, dentist == null ? null : dentist.Name ?? dentist.UserName);
            }
        }

        return (careRecord.ScheduledStart ?? careRecord.DueAt, null);
    }

    private Dictionary<string, string?> KnownValues(
        Patient? patient, CareRecord? careRecord, ClinicBranch? branch, string phone,
        (DateTimeOffset? When, string? DoctorName) visit)
    {
        var local = visit.When.HasValue ? ToClinicTime(visit.When.Value.UtcDateTime) : ClinicNow();
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            [ZaloTemplateDataBuilder.CustomerName] = patient?.FullName,
            // The send goes to 84…; a phone printed in the message reads as 0….
            [ZaloTemplateDataBuilder.Phone] = ZaloPhoneNumber.ToLocal(phone),
            [ZaloTemplateDataBuilder.CustomerCode] = patient?.PatientCode,
            [ZaloTemplateDataBuilder.ClinicName] = branch?.Name,
            [ZaloTemplateDataBuilder.ClinicPhone] = branch?.PhoneNumber,
            [ZaloTemplateDataBuilder.ClinicAddress] = branch?.Address,
            [ZaloTemplateDataBuilder.Date] = local.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            [ZaloTemplateDataBuilder.Time] = local.ToString("HH:mm", CultureInfo.InvariantCulture),
            // One of the DateTime layouts Zalo accepts: hh:mm dd/mm/yyyy.
            [ZaloTemplateDataBuilder.DateAndTime] = local.ToString("HH:mm dd/MM/yyyy", CultureInfo.InvariantCulture),
            [ZaloTemplateDataBuilder.DoctorName] = visit.DoctorName,
            [ZaloTemplateDataBuilder.ServiceName] = careRecord?.Subject,
            [ZaloTemplateDataBuilder.Note] = careRecord?.Description,
        };
    }

    private DateTime ClinicNow() => ToClinicTime(Clock.Now);

    private static DateTime ToClinicTime(DateTime instant)
    {
        var utc = DateTime.SpecifyKind(instant, DateTimeKind.Utc);
        try
        {
            return TimeZoneInfo.ConvertTimeFromUtc(utc, TimeZoneInfo.FindSystemTimeZoneById(ClinicTimeZoneId));
        }
        catch (TimeZoneNotFoundException)
        {
            return utc.AddHours(7);
        }
    }

    /// <summary>The message row's text: template name plus the values that went out.</summary>
    private static string DescribeContent(ZaloTemplateDetail detail, IReadOnlyDictionary<string, string> values)
    {
        var pairs = values.Select(kv => kv.Key + "=" + kv.Value);
        var text = detail.Name + (values.Count > 0 ? " | " + string.Join("; ", pairs) : string.Empty);
        return text.Length <= MaxContentLength ? text : text[..MaxContentLength];
    }

    /// <summary>
    /// What Zalo did with a send is a fact the moment it answers, so the row
    /// and its call log are committed on their own: a refusal survives the
    /// exception thrown afterwards, and a sent row is already visible when the
    /// delivery webhook (which can beat this request's commit) looks it up.
    /// </summary>
    private async Task PersistSendAsync(Guid branchId, MessageLog message, ZaloCallOutcome call, int itemCount)
    {
        using var uow = UnitOfWorkManager.Begin(requiresNew: true);
        await _messages.InsertAsync(message);
        await LogAsync(branchId, "zns-send", call, itemCount);
        await uow.CompleteAsync();
    }

    private Task LogAsync(Guid branchId, string operation, ZaloCallOutcome call, int itemCount = 0) =>
        _callLogs.InsertAsync(new IntegrationCallLog(
            GuidGenerator.Create(), branchId, operation, call.RequestPath,
            call.StatusCode, call.Succeeded, call.DurationMs, itemCount, call.Error));

    private static BusinessException Refused(ZaloCallOutcome call) =>
        new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloRequestFailed)
            .WithData("message", call.Error ?? "unknown");

    private ZaloOAuthCallbackResultDto Redirect(string result, string? reason, string? message = null)
    {
        var url = ReturnUrl + "?zalo=" + result;
        if (reason != null)
        {
            url += "&reason=" + Uri.EscapeDataString(reason);
        }

        if (!string.IsNullOrWhiteSpace(message))
        {
            var clipped = message.Length <= MaxRedirectMessage ? message : message[..MaxRedirectMessage];
            url += "&message=" + Uri.EscapeDataString(clipped);
        }

        return new ZaloOAuthCallbackResultDto { RedirectUrl = url };
    }

    private ZaloOaStatusDto ToStatus(Guid branchId, ZaloOaConnection? c) => new()
    {
        Id = c?.Id,
        BranchId = branchId,
        IsConnected = c?.IsConnected ?? false,
        IsEnabled = c?.IsEnabled ?? false,
        Status = c == null ? ZaloOaStatusText.None : c.Status switch
        {
            ZaloOaConnectionStatus.Active => ZaloOaStatusText.Active,
            ZaloOaConnectionStatus.Expired => ZaloOaStatusText.Expired,
            _ => ZaloOaStatusText.Failed,
        },
        OaId = c?.OaId,
        OaName = c?.OaName,
        AvatarUrl = c?.AvatarUrl,
        PackageName = c?.PackageName,
        ConnectedAt = c?.ConnectedAt,
        LastRefreshedAt = c?.LastRefreshedAt,
        AccessTokenExpiresAt = c?.AccessTokenExpiresAt,
        LastError = c?.LastError,
        HasBootstrapTokens = Options.HasBootstrapTokens,
        CanConnect = Options.HasAppCredentials,
    };

    private static ZaloTemplateDto ToTemplateDto(ZaloTemplateSummary t) => new()
    {
        TemplateId = t.TemplateId,
        Name = t.Name,
        Status = t.Status,
        Quality = t.Quality,
        CreatedAt = FromUnixMs(t.CreatedTimeMs),
    };

    private static ZaloTemplateDetailDto ToTemplateDetailDto(ZaloTemplateDetail d) => new()
    {
        TemplateId = d.TemplateId,
        Name = d.Name,
        Status = d.Status,
        Quality = d.Quality,
        PreviewUrl = d.PreviewUrl,
        Price = d.Price,
        TimeoutMs = d.TimeoutMs,
        Params = d.Params.Select(p => new ZaloTemplateParamDto
        {
            Name = p.Name,
            Required = p.Required,
            Type = p.Type,
            MaxLength = p.MaxLength,
            MinLength = p.MinLength,
            AcceptNull = p.AcceptNull,
        }).ToList(),
    };

    private static ZaloMessageDto ToMessageDto(MessageLog x) => new()
    {
        Id = x.Id,
        PatientId = x.PatientId,
        RecipientName = x.RecipientName,
        RecipientPhone = x.RecipientPhone,
        Content = x.Content,
        Status = (int)x.Status,
        Cost = x.Cost,
        SentAt = x.SentAt,
        ErrorMessage = x.ErrorMessage,
        ExternalTemplateId = x.ExternalTemplateId,
        ExternalMessageId = x.ExternalMessageId,
        TemplateName = x.TemplateName,
        CreationTime = x.CreationTime,
    };

    private static DateTime? FromUnixMs(long? ms) =>
        ms.HasValue ? DateTimeOffset.FromUnixTimeMilliseconds(ms.Value).UtcDateTime : null;
}
