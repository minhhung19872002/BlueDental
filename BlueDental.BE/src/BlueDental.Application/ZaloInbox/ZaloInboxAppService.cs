using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;
using Volo.Abp.Users;

namespace BlueDental.ZaloInbox;

/// <summary>
/// CSKH ▸ Hộp thư Zalo (BA P2210, F-80). Everything is the current branch's:
/// its OA, its conversations, its records. Reading needs cskhInbox.read; every
/// step that changes a conversation needs cskhInbox.update, and answering,
/// handing on and letting go need the caller to hold it ("Nhận xử lý").
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhInbox.Read)]
public class ZaloInboxAppService(
    IRepository<ZaloConversation, Guid> conversations,
    IRepository<Patient, Guid> patients,
    ZaloInboxReader reader,
    ZaloInboxSync sync,
    ZaloInboxAssignees assignees,
    ZaloInboxIngestor ingestor,
    ZaloInfoRequester infoRequester,
    ZaloOaGateway zalo,
    IZaloApiClient zaloApi,
    PatientPhoneMasker phoneMasker,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IZaloInboxAppService
{
    /// <summary>The list shows this many conversations; the search reaches the rest.</summary>
    public const int MaxListed = 200;

    public const int MaxPatientResults = 20;

    public async Task<ZaloInboxListDto> GetListAsync(GetZaloConversationsInput input)
    {
        var branchId = await GetBranchIdAsync();
        var me = CurrentUser.GetId();
        var now = Clock.Now;

        var query = await SearchAsync(branchId, input.Filter);
        var counts = await CountAsync(query, me, now);

        // Chưa trả lời: who has waited longest first, as the BA mock lists them.
        var shown = input.Tab switch
        {
            ZaloInboxTab.Unreplied => query.Where(c => c.Status == ZaloConversationStatus.Unreplied)
                .OrderBy(c => c.LastCustomerMessageAt),
            ZaloInboxTab.Mine => query.Where(c => c.HolderId == me && c.HeldUntil > now)
                .OrderByDescending(c => c.LastMessageAt),
            ZaloInboxTab.Cared => query.Where(c => c.Status == ZaloConversationStatus.Cared)
                .OrderByDescending(c => c.LastMessageAt),
            _ => query.OrderByDescending(c => c.LastMessageAt),
        };
        var items = await AsyncExecuter.ToListAsync(shown.Take(MaxListed));
        var connection = await zalo.FindConnectionAsync(branchId);

        return new ZaloInboxListDto
        {
            Connected = connection?.IsConnected == true,
            OaName = connection?.OaName,
            Items = await reader.SummariesAsync(items, now),
            Counts = counts,
        };
    }

    public async Task<ZaloInboxCountsDto> GetCountsAsync() =>
        await CountAsync(await SearchAsync(await GetBranchIdAsync(), null), CurrentUser.GetId(), Clock.Now);

    public async Task<ZaloConversationDetailDto> GetAsync(Guid id) =>
        await reader.DetailAsync(await GetConversationAsync(id), Clock.Now);

    public async Task<List<ZaloChatEntryDto>> GetMessagesAsync(Guid id) =>
        await reader.TimelineAsync(await GetConversationAsync(id));

    public async Task<ZaloChatSyncResultDto> SyncRecentAsync()
    {
        var branchId = await GetBranchIdAsync();
        var connection = await zalo.FindConnectionAsync(branchId);
        return connection is { IsConnected: true }
            ? await sync.SyncRecentAsync(connection)
            : new ZaloChatSyncResultDto();
    }

    public async Task<ZaloChatSyncResultDto> SyncConversationAsync(Guid id, SyncZaloConversationInput input)
    {
        var conversation = await GetConversationAsync(id);
        var connection = await zalo.FindConnectionAsync(conversation.ClinicBranchId);
        return connection is { IsConnected: true }
            ? await sync.SyncConversationAsync(connection, conversation, input.Offset)
            : new ZaloChatSyncResultDto();
    }

    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloConversationDetailDto> ClaimAsync(Guid id)
    {
        var conversation = await GetConversationAsync(id);
        conversation.Claim(CurrentUser.GetId(), Clock.Now);
        return await SaveAsync(conversation);
    }

    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloConversationDetailDto> ReleaseAsync(Guid id)
    {
        var conversation = await GetConversationAsync(id);
        conversation.Release(CurrentUser.GetId(), Clock.Now);
        return await SaveAsync(conversation);
    }

    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloConversationDetailDto> TransferAsync(Guid id, TransferZaloConversationInput input)
    {
        var conversation = await GetConversationAsync(id);
        conversation.EnsureHeldBy(CurrentUser.GetId(), Clock.Now);
        await assignees.CheckAsync(conversation.ClinicBranchId, input.UserId);
        conversation.TransferTo(CurrentUser.GetId(), input.UserId, Clock.Now);
        return await SaveAsync(conversation);
    }

    public async Task<List<ZaloInboxAssigneeDto>> GetAssigneesAsync() =>
        await assignees.ListAsync(await GetBranchIdAsync(), CurrentUser.GetId());

    /// <summary>
    /// A text "tin tư vấn" through the OA. Zalo is asked first; only what it
    /// took is stored, under the id it gave — the <c>oa_send_text</c> echo of
    /// the same id is then dropped as already known.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloChatEntryDto> SendMessageAsync(Guid id, SendZaloChatMessageInput input)
    {
        var text = input.Text?.Trim() ?? string.Empty;
        if (text.Length == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.MessageRequired);
        }

        if (text.Length > ZaloInboxConsts.MaxMessageLength)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.MessageTooLong)
                .WithData("max", ZaloInboxConsts.MaxMessageLength);
        }

        var conversation = await GetConversationAsync(id);
        var me = CurrentUser.GetId();
        conversation.EnsureHeldBy(me, Clock.Now);
        conversation.EnsureCanReplyFreely(Clock.Now);
        var connection = await GetSendingConnectionAsync(conversation.ClinicBranchId);

        var outcome = await zalo.CallWithTokenAsync(connection,
            token => zaloApi.SendTextMessageAsync(token, conversation.ZaloUserId, text),
            o => o.Call);
        using (var uow = UnitOfWorkManager.Begin(requiresNew: true))
        {
            await zalo.LogAsync(conversation.ClinicBranchId, "cs-send", outcome.Call, outcome.Call.Succeeded ? 1 : 0);
            await uow.CompleteAsync();
        }

        if (!outcome.Call.Succeeded)
        {
            throw ZaloOaGateway.Refused(outcome.Call);
        }

        var now = Clock.Now;
        var message = new ZaloChatMessage(
            GuidGenerator.Create(), conversation, outcome.MessageId, ZaloChatDirection.Outbound,
            ZaloChatKind.Text, text, null, now, me);
        await ingestor.StoreReplyAsync(conversation, message, me, now);
        return ZaloInboxReader.ToEntry(message, await reader.UserNamesAsync([me]));
    }

    /// <summary>
    /// R-1028 "Xin SĐT": the card asking for the phone, again — under the same
    /// rules as an answer (the caller holds it, Zalo's 48 hours), yet not one:
    /// the conversation's status stays as it was.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloChatEntryDto> RequestInfoAsync(Guid id)
    {
        var conversation = await GetConversationAsync(id);
        var me = CurrentUser.GetId();
        conversation.EnsureHeldBy(me, Clock.Now);
        conversation.EnsureCanReplyFreely(Clock.Now);
        var connection = await GetSendingConnectionAsync(conversation.ClinicBranchId);

        var card = await infoRequester.SendAsync(connection, conversation, me);
        await ingestor.StoreInfoRequestAsync(conversation, card);
        return ZaloInboxReader.ToEntry(card, await reader.UserNamesAsync([me]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<List<string>> SetTagsAsync(Guid id, SetZaloConversationTagsInput input)
    {
        var conversation = await GetConversationAsync(id);
        conversation.SetTags(input.Tags);
        await conversations.UpdateAsync(conversation);
        return [.. conversation.Tags];
    }

    /// <summary>The branch's tags in use, most used first.</summary>
    public async Task<List<string>> GetTagSuggestionsAsync()
    {
        var branchId = await GetBranchIdAsync();
        var lists = await AsyncExecuter.ToListAsync((await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId)
            .Select(c => c.Tags));
        return [.. lists.SelectMany(tags => tags)
            .GroupBy(tag => tag, StringComparer.CurrentCultureIgnoreCase)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key, StringComparer.CurrentCultureIgnoreCase)
            .Select(g => g.First())
            .Take(50)];
    }

    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloConversationDetailDto> LinkPatientAsync(Guid id, LinkZaloConversationPatientInput input)
    {
        var conversation = await GetConversationAsync(id);
        if (input.PatientId is { } patientId
            && !await patients.AnyAsync(p => p.Id == patientId && p.BranchId == conversation.ClinicBranchId))
        {
            throw new EntityNotFoundException(typeof(Patient), patientId);
        }

        conversation.LinkPatient(input.PatientId);
        return await SaveAsync(conversation);
    }

    public async Task<List<ZaloInboxPatientDto>> FindPatientsAsync(FindZaloInboxPatientsInput input)
    {
        var branchId = await GetBranchIdAsync();
        var wholePhone = await phoneMasker.ShouldMaskAsync();
        var query = (await patients.GetQueryableAsync()).Where(p => p.BranchId == branchId);
        foreach (var term in Terms(input.Filter))
        {
            query = query.Where(p =>
                DbText.Unaccent((p.LastName + " " + p.FirstName).ToLower()).Contains(DbText.Unaccent(term))
                || p.PatientCode.ToLower().Contains(term)
                || (p.Contact.PhoneNumber != null
                    && (wholePhone ? p.Contact.PhoneNumber == term : p.Contact.PhoneNumber.Contains(term))));
        }

        var found = await AsyncExecuter.ToListAsync(query.OrderByDescending(p => p.CreationTime).Take(MaxPatientResults));
        return [.. found.Select(p => new ZaloInboxPatientDto
        {
            Id = p.Id,
            Name = p.FullName,
            Code = p.PatientCode,
            Phone = p.Contact.PhoneNumber,
        })];
    }

    /// <summary>
    /// The branch's conversations with at least one message, narrowed by the
    /// search: the Zalo name and shared phone, or the linked record's name,
    /// code and phone. A hidden phone is matched whole only.
    /// </summary>
    private async Task<IQueryable<ZaloConversation>> SearchAsync(Guid branchId, string? filter)
    {
        var query = (await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && c.LastMessageAt != null);
        var terms = Terms(filter);
        if (terms.Count == 0)
        {
            return query;
        }

        var wholePhone = await phoneMasker.ShouldMaskAsync();
        var records = (await patients.GetQueryableAsync()).Where(p => p.BranchId == branchId);
        foreach (var term in terms)
        {
            var matching = records
                .Where(p => DbText.Unaccent((p.LastName + " " + p.FirstName).ToLower()).Contains(DbText.Unaccent(term))
                    || p.PatientCode.ToLower().Contains(term)
                    || (p.Contact.PhoneNumber != null
                        && (wholePhone ? p.Contact.PhoneNumber == term : p.Contact.PhoneNumber.Contains(term))))
                .Select(p => (Guid?)p.Id);
            query = query.Where(c =>
                DbText.Unaccent(c.DisplayName.ToLower()).Contains(DbText.Unaccent(term))
                || (c.SharedPhone != null && (wholePhone ? c.SharedPhone == term : c.SharedPhone.Contains(term)))
                || matching.Contains(c.PatientId));
        }

        return query;
    }

    private async Task<ZaloInboxCountsDto> CountAsync(IQueryable<ZaloConversation> query, Guid me, DateTime now) => new()
    {
        Unreplied = await AsyncExecuter.CountAsync(query.Where(c => c.Status == ZaloConversationStatus.Unreplied)),
        Mine = await AsyncExecuter.CountAsync(query.Where(c => c.HolderId == me && c.HeldUntil > now)),
        Cared = await AsyncExecuter.CountAsync(query.Where(c => c.Status == ZaloConversationStatus.Cared)),
        All = await AsyncExecuter.CountAsync(query),
    };

    private static List<string> Terms(string? filter) =>
        [.. (filter ?? string.Empty).Trim().ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries)];

    private async Task<ZaloConversationDetailDto> SaveAsync(ZaloConversation conversation)
    {
        await conversations.UpdateAsync(conversation, autoSave: true);
        return await reader.DetailAsync(conversation, Clock.Now);
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    /// <summary>Another branch's conversation is not found, never refused: its existence is not told.</summary>
    private async Task<ZaloConversation> GetConversationAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await conversations.FirstOrDefaultAsync(c => c.Id == id && c.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(ZaloConversation), id);
    }

    private async Task<ZaloOaConnection> GetSendingConnectionAsync(Guid branchId)
    {
        var connection = await zalo.GetConnectionAsync(branchId);
        connection.EnsureCanSend();
        return connection;
    }
}
