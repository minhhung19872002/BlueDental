using System;
using System.Text.Json;
using System.Threading.Tasks;
using BlueDental.ClinicIntegration;
using BlueDental.Tools;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.Zalo;

/// <summary>
/// Verifies Zalo's signature when the OA secret is configured and turns a
/// delivery event for a message we sent into <see cref="MessageLog.MarkDelivered"/>.
/// Only the event name is logged: the payload carries the recipient's data.
/// </summary>
public class ZaloWebhookHandler : IZaloWebhookHandler, ITransientDependency
{
    public const string Operation = "webhook";

    private readonly IRepository<MessageLog, Guid> _messages;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IUnitOfWorkManager _unitOfWorkManager;
    private readonly IOptions<ZaloOptions> _options;
    private readonly IGuidGenerator _guids;
    private readonly IClock _clock;
    private readonly ILogger<ZaloWebhookHandler> _logger;

    public ZaloWebhookHandler(
        IRepository<MessageLog, Guid> messages,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IUnitOfWorkManager unitOfWorkManager,
        IOptions<ZaloOptions> options,
        IGuidGenerator guids,
        IClock clock,
        ILogger<ZaloWebhookHandler> logger)
    {
        _messages = messages;
        _callLogs = callLogs;
        _unitOfWorkManager = unitOfWorkManager;
        _options = options;
        _guids = guids;
        _clock = clock;
        _logger = logger;
    }

    public async Task<ZaloWebhookResult> HandleAsync(string body, string? signatureHeader)
    {
        var options = _options.Value;
        using var document = TryParse(body);
        var root = document?.RootElement;

        var eventName = root is { } r ? Text(r, "event_name") : null;
        var timestamp = root is { } t ? Text(t, "timestamp") : null;

        if (string.IsNullOrWhiteSpace(options.WebhookSecret))
        {
            _logger.LogWarning("Zalo webhook rejected: WebhookSecret is not configured");
            return ZaloWebhookResult.Unauthorized;
        }

        if (!string.IsNullOrWhiteSpace(options.AppId))
        {
            var valid = ZaloWebhookSignature.Verify(
                signatureHeader, options.AppId, body, timestamp ?? string.Empty, options.WebhookSecret);
            if (!valid)
            {
                _logger.LogWarning("Zalo webhook rejected: bad signature for {EventName}", eventName ?? "<unknown>");
                return ZaloWebhookResult.Unauthorized;
            }
        }

        _logger.LogInformation("Zalo webhook received: {EventName}", eventName ?? "<unknown>");

        var messageId = root is { } m ? FindMessageId(m) : null;
        if (messageId == null)
        {
            return ZaloWebhookResult.Accepted;
        }

        using var uow = _unitOfWorkManager.Begin(requiresNew: true);

        var message = await _messages.FirstOrDefaultAsync(x => x.ExternalMessageId == messageId);
        if (message != null)
        {
            var now = _clock.Now;
            message.MarkDelivered(now);
            await _messages.UpdateAsync(message);
            await _callLogs.InsertAsync(new IntegrationCallLog(
                _guids.Create(), message.ClinicBranchId, Operation, eventName ?? "event",
                200, true, 0, 1, null));
        }

        await uow.CompleteAsync();
        return ZaloWebhookResult.Accepted;
    }

    /// <summary>Zalo puts <c>msg_id</c> at the root for ZNS events and under <c>message</c> for OA chat events.</summary>
    private static string? FindMessageId(JsonElement root)
    {
        var id = Text(root, "msg_id");
        if (id != null)
        {
            return id;
        }

        if (root.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.Object)
        {
            return Text(message, "msg_id");
        }

        return null;
    }

    private static JsonDocument? TryParse(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                return document;
            }

            document.Dispose();
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
    }
}
