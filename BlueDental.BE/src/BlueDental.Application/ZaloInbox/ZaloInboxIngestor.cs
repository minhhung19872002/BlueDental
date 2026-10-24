using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Marketing;
using BlueDental.PatientManagement;
using BlueDental.Zalo;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;

namespace BlueDental.ZaloInbox;

/// <summary>A chat message as Zalo handed it over — by webhook, history sync or our own send.</summary>
public sealed record ZaloIncomingChat(
    string ZaloUserId,
    string? MessageId,
    ZaloChatDirection Direction,
    ZaloChatKind Kind,
    string? Text,
    string? AttachmentUrl,
    DateTime SentAt);

/// <summary>
/// Where every message enters Hộp thư Zalo: the webhook, a sync and a reply
/// all go through here, so a conversation is opened once per Zalo user and a
/// message stored once per Zalo message id. A new conversation asks Zalo who
/// the user is and links the branch's record holding the phone they shared;
/// an unlinked one tries that phone again each time it comes through (R-1026).
/// </summary>
public class ZaloInboxIngestor(
    IRepository<ZaloConversation, Guid> conversations,
    IRepository<ZaloChatMessage, Guid> messages,
    IRepository<Patient, Guid> patients,
    ZaloOaGateway gateway,
    IZaloApiClient zalo,
    IAsyncQueryableExecuter asyncExecuter,
    IGuidGenerator guids) : ITransientDependency
{
    /// <param name="askPhoneAgain">
    /// A sync's: an unlinked conversation with no shared phone asks Zalo again,
    /// the customer may have shared it since.
    /// </param>
    public async Task<ZaloConversation> EnsureConversationAsync(
        ZaloOaConnection connection, string zaloUserId, string? nameHint = null, string? avatarHint = null,
        bool askPhoneAgain = false)
    {
        var branchId = connection.ClinicBranchId;
        var existing = await conversations.FirstOrDefaultAsync(c => c.ClinicBranchId == branchId && c.ZaloUserId == zaloUserId);
        if (existing != null)
        {
            if (existing.AvatarUrl == null && !string.IsNullOrWhiteSpace(avatarHint))
            {
                existing.SetProfile(existing.DisplayName, avatarHint, null);
            }

            if (askPhoneAgain && existing.PatientId == null && existing.SharedPhone == null)
            {
                existing.ShareContact((await TryReadProfileAsync(connection, zaloUserId))?.SharedPhone);
            }

            // The record may have been made after the phone was shared.
            await LinkBySharedPhoneAsync(existing);
            return existing;
        }

        var profile = await TryReadProfileAsync(connection, zaloUserId);
        var conversation = ZaloConversation.Open(
            guids.Create(), branchId, zaloUserId,
            profile?.DisplayName ?? nameHint, profile?.AvatarUrl ?? avatarHint, profile?.SharedPhone);
        await LinkBySharedPhoneAsync(conversation);
        return await conversations.InsertAsync(conversation, autoSave: true);
    }

    /// <summary>
    /// False when Zalo's id is already stored: the second arrival of the same
    /// message. That arrival still fills in words the stored one lacks.
    /// </summary>
    public async Task<bool> RecordAsync(ZaloConversation conversation, ZaloIncomingChat chat, Guid? senderUserId = null)
    {
        if (chat.MessageId is { } id)
        {
            var known = await messages.FirstOrDefaultAsync(m =>
                m.ClinicBranchId == conversation.ClinicBranchId && m.ZaloMessageId == id);
            if (known != null)
            {
                if (known.ConversationId == conversation.Id && known.FillMissingText(chat.Text, chat.AttachmentUrl))
                {
                    await messages.UpdateAsync(known, autoSave: true);
                    conversation.RefreshPreview(known.SentAt, known.Preview);
                    await conversations.UpdateAsync(conversation);
                }

                return false;
            }
        }

        var message = new ZaloChatMessage(
            guids.Create(), conversation, chat.MessageId, chat.Direction, chat.Kind,
            chat.Text, chat.AttachmentUrl, chat.SentAt, senderUserId);
        // Saved at once: the next message's duplicate check reads the table.
        await messages.InsertAsync(message, autoSave: true);
        conversation.RecordMessage(chat.Direction, chat.SentAt, message.Preview);
        await conversations.UpdateAsync(conversation);
        return true;
    }

    /// <summary>
    /// What the holder sent from Hộp thư Zalo, Zalo having taken it. Zalo's
    /// <c>oa_send_*</c> echo can beat this to the table; the echoed row then
    /// gets its sender instead of a second row being written.
    /// </summary>
    public async Task StoreReplyAsync(ZaloConversation conversation, ZaloChatMessage message, Guid senderUserId, DateTime now)
    {
        // Only an echo of this conversation: a message of another one is never this reply.
        var echo = message.ZaloMessageId is { } id
            ? await messages.FirstOrDefaultAsync(m => m.ConversationId == conversation.Id && m.ZaloMessageId == id)
            : null;
        if (echo != null)
        {
            echo.AttributeTo(senderUserId);
            await messages.UpdateAsync(echo);
        }
        else
        {
            await messages.InsertAsync(message);
        }

        conversation.RecordReply(senderUserId, message.SentAt, message.Preview, now);
        await conversations.UpdateAsync(conversation, autoSave: true);
    }

    /// <summary>
    /// R-1026: an unlinked conversation whose customer shared a phone takes the
    /// branch's one record holding it. A linked one keeps its record.
    /// </summary>
    public async Task<bool> LinkBySharedPhoneAsync(ZaloConversation conversation) =>
        conversation.PatientId == null && conversation.SharedPhone != null
        && conversation.LinkFoundPatient(await FindPatientByPhoneAsync(conversation.ClinicBranchId, conversation.SharedPhone));

    /// <summary>
    /// The one record of the branch holding the number, in any spelling it may
    /// be stored in. Two records with the same phone link neither: staff pick.
    /// </summary>
    public async Task<Guid?> FindPatientByPhoneAsync(Guid branchId, string? phone)
    {
        string normalized;
        try
        {
            normalized = TicketPhone.Normalize(phone);
        }
        catch (BusinessException)
        {
            return null;
        }

        var variants = TicketPhone.Variants(normalized).ToList();
        var ids = await asyncExecuter.ToListAsync((await patients.GetQueryableAsync())
            .Where(p => p.BranchId == branchId && variants.Contains(p.Contact.PhoneNumber))
            .Select(p => p.Id)
            .Take(2));
        return ids.Count == 1 ? ids[0] : null;
    }

    /// <summary>Zalo out of reach leaves the profile unknown; the conversation opens all the same.</summary>
    private async Task<ZaloUserProfile?> TryReadProfileAsync(ZaloOaConnection connection, string zaloUserId)
    {
        var outcome = await gateway.CallWithTokenAsync(connection,
            token => zalo.GetUserDetailAsync(token, zaloUserId),
            o => o.Call);
        await gateway.LogAsync(connection.ClinicBranchId, "user-detail", outcome.Call, outcome.User == null ? 0 : 1);
        return outcome.User;
    }
}
