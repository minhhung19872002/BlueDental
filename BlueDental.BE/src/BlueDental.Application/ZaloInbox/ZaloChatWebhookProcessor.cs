using System;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.Extensions.Logging;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.ZaloInbox;

/// <summary>
/// The chat side of Zalo's webhook for Hộp thư Zalo: <c>user_send_*</c> is the
/// customer writing, <c>oa_send_*</c> the OA answering — from BlueDental (an
/// echo, dropped by message id) or from Zalo's own OA chat; <c>user_submit_info</c>
/// the customer sending the OA their details. The OA id names the branch. Logs
/// carry event names, ids and field names only, never what was written.
/// </summary>
public class ZaloChatWebhookProcessor(
    IRepository<ZaloOaConnection, Guid> connections,
    IRepository<ZaloConversation, Guid> conversations,
    ZaloInboxIngestor ingestor,
    IUnitOfWorkManager unitOfWorkManager,
    IClock clock,
    ILogger<ZaloChatWebhookProcessor> logger) : ITransientDependency
{
    /// <summary>"Người dùng gửi thông tin": <c>sender.id</c> the user, <c>info.phone</c> their phone.</summary>
    public const string SharedInfoEvent = "user_submit_info";

    /// <summary>True when the event was a chat message (stored or already known) or the customer's details.</summary>
    public async Task<bool> TryHandleAsync(string? eventName, JsonElement root)
    {
        if (eventName == SharedInfoEvent)
        {
            await StoreSharedInfoAsync(root);
            return true;
        }

        if (ZaloChatKinds.OfEvent(eventName) is not { } shape)
        {
            return false;
        }

        var senderId = IdOf(root, "sender");
        var recipientId = IdOf(root, "recipient");
        var (userId, oaId) = shape.Direction == ZaloChatDirection.Inbound ? (senderId, recipientId) : (recipientId, senderId);
        if (userId == null || oaId == null || !root.TryGetProperty("message", out var message)
            || message.ValueKind != JsonValueKind.Object)
        {
            return true;
        }

        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            var connection = await FindConnectionAsync(oaId);
            if (connection == null)
            {
                logger.LogInformation("Zalo chat event {EventName} for an OA no branch links", eventName);
                return true;
            }

            var (kind, attachment) = AttachmentOf(message, shape.Kind);
            if (Text(message, "text") == null && attachment == null)
            {
                // R-1023: which fields such a message has (the OA's welcome card…), never their values.
                logger.LogInformation("Zalo chat event {EventName} came without words or a link; message fields: {Fields}",
                    eventName, ZaloJsonShape.Describe(message));
            }

            var conversation = await ingestor.EnsureConversationAsync(connection, userId);
            await ingestor.RecordAsync(conversation, new ZaloIncomingChat(
                userId, Text(message, "msg_id"), shape.Direction, kind, Text(message, "text"), attachment,
                TimeOf(root) ?? clock.Now));
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            // Zalo resends nothing; the history sync picks a lost message up.
            logger.LogWarning(ex, "Zalo chat event {EventName} could not be stored", eventName);
        }

        return true;
    }

    /// <summary>
    /// A ZNS reached the customer: Zalo names their user id as the recipient,
    /// so the record the ZNS was sent to becomes that conversation's record —
    /// opened now, empty, when they never wrote, so a later message lands linked.
    /// </summary>
    public async Task LinkZnsRecipientAsync(MessageLog delivered, JsonElement root)
    {
        var userId = IdOf(root, "recipient");
        var oaId = IdOf(root, "sender");
        if (delivered.PatientId is not { } patientId || userId == null || userId == oaId || !userId.All(char.IsDigit))
        {
            return;
        }

        var connection = await FindConnectionAsync(oaId);
        if (connection == null || connection.ClinicBranchId != delivered.ClinicBranchId)
        {
            return;
        }

        try
        {
            var conversation = await conversations.FirstOrDefaultAsync(c =>
                    c.ClinicBranchId == connection.ClinicBranchId && c.ZaloUserId == userId)
                ?? await ingestor.EnsureConversationAsync(connection, userId, delivered.RecipientName);
            if (conversation.PatientId == null)
            {
                conversation.LinkPatient(patientId);
                await conversations.UpdateAsync(conversation);
            }
        }
        catch (Exception ex)
        {
            // The delivery itself is recorded either way; the link can be made by hand.
            logger.LogWarning(ex, "Zalo ZNS recipient could not be linked to its conversation");
        }
    }

    /// <summary>
    /// R-1026: the phone the customer sent becomes the conversation's, and an
    /// unlinked conversation takes the branch's one record holding it.
    /// </summary>
    private async Task StoreSharedInfoAsync(JsonElement root)
    {
        var userId = IdOf(root, "sender");
        var oaId = IdOf(root, "recipient");
        var info = root.TryGetProperty("info", out var shared) && shared.ValueKind == JsonValueKind.Object ? shared : default;
        var phone = info.ValueKind == JsonValueKind.Object ? Text(info, "phone") : null;
        if (userId == null || oaId == null || phone == null)
        {
            // Zalo's payload not as read here: which fields it has, never their values.
            logger.LogInformation("Zalo {EventName} came without a user, an OA or a phone; fields: {Fields}",
                SharedInfoEvent, ZaloJsonShape.Describe(root));
            return;
        }

        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            var connection = await FindConnectionAsync(oaId);
            if (connection == null)
            {
                logger.LogInformation("Zalo {EventName} for an OA no branch links", SharedInfoEvent);
                return;
            }

            var conversation = await ingestor.EnsureConversationAsync(connection, userId, Text(info, "name"));
            conversation.ShareContact(phone);
            await ingestor.LinkBySharedPhoneAsync(conversation);
            await conversations.UpdateAsync(conversation);
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            // The next sync asks Zalo for the phone again.
            logger.LogWarning(ex, "Zalo {EventName} could not be stored", SharedInfoEvent);
        }
    }

    /// <summary>The branch whose live link is this OA; the earliest linked when two branches share one.</summary>
    private async Task<ZaloOaConnection?> FindConnectionAsync(string? oaId)
    {
        if (string.IsNullOrWhiteSpace(oaId))
        {
            return null;
        }

        return (await connections.GetListAsync(c => c.OaId == oaId && c.Status == ZaloOaConnectionStatus.Active))
            .OrderBy(c => c.ConnectedAt)
            .FirstOrDefault();
    }

    /// <summary>The first attachment's kind and link: the image, the sticker, the file, the link…</summary>
    private static (ZaloChatKind Kind, string? Url) AttachmentOf(JsonElement message, ZaloChatKind eventKind)
    {
        if (!message.TryGetProperty("attachments", out var attachments) || attachments.ValueKind != JsonValueKind.Array)
        {
            return (eventKind, null);
        }

        foreach (var attachment in attachments.EnumerateArray())
        {
            if (attachment.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var kind = eventKind == ZaloChatKind.Other ? ZaloChatKinds.OfHistoryType(Text(attachment, "type")) : eventKind;
            string? url = null;
            if (attachment.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object)
            {
                url = Text(payload, "url") ?? Text(payload, "thumbnail");
            }

            return (kind, url);
        }

        return (eventKind, null);
    }

    private static DateTime? TimeOf(JsonElement root) =>
        long.TryParse(Text(root, "timestamp"), NumberStyles.Integer, CultureInfo.InvariantCulture, out var ms) && ms > 0
            ? DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime
            : null;

    private static string? IdOf(JsonElement root, string name) =>
        root.TryGetProperty(name, out var party) && party.ValueKind == JsonValueKind.Object ? Text(party, "id") : null;

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
    }
}
