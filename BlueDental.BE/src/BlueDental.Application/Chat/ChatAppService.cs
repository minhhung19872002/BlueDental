using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.FileManagement;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.Auditing;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Chat;

/// <summary>
/// Chat nội bộ (F-89, BlueDental-local). Every signed-in account may chat, so
/// there is no permission of its own (like the header notes, F-74); what each
/// caller sees is decided by membership:
///
/// - A conversation is visible to its members only, and only while they may
///   still open its branch; to anybody else it does not exist (404).
/// - New conversations land in the selected branch (the account's own when
///   none is named), and everyone in them must pass <see cref="ChatParticipantPolicy"/>.
/// - The list and the unread badge follow the branch picker like every screen.
/// </summary>
[Authorize]
public class ChatAppService(
    IRepository<ChatConversation, Guid> conversations,
    IRepository<ChatMember, Guid> members,
    IRepository<ChatMessage, Guid> messages,
    IRepository<ChatAttachment, Guid> attachments,
    IRepository<ChatMessageRevision, Guid> revisions,
    IIdentityUserRepository userRepository,
    ChatConversationManager conversationManager,
    ChatParticipantPolicy participantPolicy,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess,
    IBlobContainer blobContainer,
    IChatCipher cipher,
    IChatNotifier notifier,
    IMalwareScanner malwareScanner,
    ChatMessageSearch messageSearch) : BlueDentalAppService, IChatAppService
{
    private const int MaxContacts = 50;
    private const int MaxConversations = 300;

    public async Task<List<ChatContactDto>> GetContactsAsync(GetChatContactsInput input)
    {
        var userId = CurrentUser.GetId();
        var branchId = await GetWriteBranchAsync();
        var query = (await participantPolicy.GetEligibleQueryAsync(branchId)).Where(u => u.Id != userId);

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(u => DbText.Unaccent(((u.Surname ?? "") + " " + (u.Name ?? "") + " " + u.UserName).ToLower())
                .Contains(DbText.Unaccent(term)));
        }

        var users = await AsyncExecuter.ToListAsync(query.OrderBy(u => u.Name).ThenBy(u => u.Surname).Take(MaxContacts));
        return users.Select(u => new ChatContactDto { Id = u.Id, FullName = FullName(u), UserName = u.UserName }).ToList();
    }

    public async Task<List<ChatConversationDto>> GetConversationsAsync(GetChatConversationsInput input)
    {
        var userId = CurrentUser.GetId();
        var query = await MyConversationsQueryAsync(userId);
        var found = await AsyncExecuter.ToListAsync(query.OrderByDescending(c => c.CreationTime).Take(MaxConversations));
        var summaries = await SummarizeAsync(found, userId);

        var terms = SearchTerms.From(input.Filter).Select(SearchTerms.Fold).ToList();
        return summaries
            .Where(s => terms.Count == 0 || MatchesAll(s, terms))
            .OrderByDescending(s => s.LastActivityAt)
            .ToList();
    }

    public async Task<ChatConversationDto> GetConversationAsync(Guid id)
    {
        var conversation = await GetVisibleAsync(id);
        return await SummarizeOneAsync(conversation);
    }

    public async Task<ChatConversationDto> OpenDirectAsync(CreateDirectChatInput input)
    {
        var userId = CurrentUser.GetId();
        var branchId = await GetWriteBranchAsync();
        var conversation = await conversationManager.OpenDirectAsync(branchId, userId, input.UserId);
        await NotifyMembersAsync(conversation.Id);
        return await SummarizeOneAsync(conversation);
    }

    public async Task<ChatConversationDto> CreateGroupAsync(CreateGroupChatInput input)
    {
        var branchId = await GetWriteBranchAsync();
        var conversation = await conversationManager.CreateGroupAsync(branchId, input.Name, CurrentUser.GetId(), input.MemberIds);
        await NotifyMembersAsync(conversation.Id);
        return await SummarizeOneAsync(conversation);
    }

    public async Task<ChatConversationDto> RenameAsync(Guid id, RenameChatInput input)
    {
        var conversation = await GetVisibleAsync(id);
        conversation.Rename(input.Name);
        await conversations.UpdateAsync(conversation, autoSave: true);
        await NotifyMembersAsync(conversation.Id);
        return await SummarizeOneAsync(conversation);
    }

    public async Task<ChatConversationDto> AddMembersAsync(Guid id, AddChatMembersInput input)
    {
        var conversation = await GetVisibleAsync(id);
        await conversationManager.AddMembersAsync(conversation, CurrentUser.GetId(), input.UserIds);
        await NotifyMembersAsync(conversation.Id);
        return await SummarizeOneAsync(conversation);
    }

    public async Task LeaveAsync(Guid id)
    {
        var conversation = await GetVisibleAsync(id);
        var everyone = await conversationManager.GetMemberIdsAsync(id);
        await conversationManager.LeaveAsync(conversation, CurrentUser.GetId());
        await notifier.NotifyAsync(id, everyone);
    }

    public async Task RemoveMemberAsync(Guid id, Guid userId)
    {
        var conversation = await GetVisibleAsync(id);
        // Told before the row goes, so the removed person's screen drops the group too.
        var everyone = await conversationManager.GetMemberIdsAsync(id);
        await conversationManager.RemoveMemberAsync(conversation, CurrentUser.GetId(), userId);
        await notifier.NotifyAsync(id, everyone);
    }

    public async Task MarkReadAsync(Guid id)
    {
        var userId = CurrentUser.GetId();
        await GetVisibleAsync(id);
        var member = await conversationManager.GetMemberAsync(id, userId);
        if (member.MarkRead(Clock.Now))
        {
            await members.UpdateAsync(member, autoSave: true);
            // The caller's other tabs drop the badge too.
            await notifier.NotifyAsync(id, [userId]);
        }
    }

    public async Task<ChatMessagePageDto> GetMessagesAsync(Guid id, GetChatMessagesInput input)
    {
        await GetVisibleAsync(id);
        var query = (await messages.GetQueryableAsync()).Where(m => m.ConversationId == id);

        if (input.BeforeId is { } beforeId)
        {
            var pivot = await messages.FirstOrDefaultAsync(m => m.Id == beforeId && m.ConversationId == id)
                ?? throw new EntityNotFoundException(typeof(ChatMessage), beforeId);
            query = query.Where(m => m.SentAt < pivot.SentAt);
        }

        var page = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(m => m.SentAt)
            .ThenByDescending(m => m.Id)
            .Take(input.MaxResultCount + 1));

        var hasMore = page.Count > input.MaxResultCount;
        return new ChatMessagePageDto
        {
            Items = await MapMessagesAsync(page.Take(input.MaxResultCount).ToList(), CurrentUser.GetId()),
            HasMore = hasMore,
        };
    }

    public async Task<ChatMessageSearchResultDto> SearchMessagesAsync(Guid id, SearchChatMessagesInput input)
    {
        await GetVisibleAsync(id);
        var result = await messageSearch.FindAsync(id, input.Text);
        return new ChatMessageSearchResultDto
        {
            Items = await MapMessagesAsync(result.Found, CurrentUser.GetId()),
            IsComplete = result.IsComplete,
        };
    }

    /// <remarks>
    /// Not audited: the audit log would keep the file name in clear. Who uploaded
    /// what and when stays on the attachment row (CreatorId / CreationTime).
    /// </remarks>
    [DisableAuditing]
    public async Task<ChatAttachmentDto> UploadAttachmentAsync(Guid id, IRemoteStreamContent file)
    {
        var conversation = await GetVisibleAsync(id);
        var fileName = ChatAttachmentFiles.CleanFileName(file.FileName);
        var contentType = ChatAttachmentFiles.ContentTypeOf(fileName);
        if (contentType is null || fileName.Length > ChatConsts.MaxFileNameLength
            || Path.GetFileNameWithoutExtension(fileName).Length == 0)
        {
            throw InvalidAttachment();
        }

        using var buffer = await ReadCappedAsync(file.GetStream());
        if (buffer.Length == 0
            || !ChatAttachmentFiles.HasExpectedSignature(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 512)), contentType))
        {
            throw InvalidAttachment();
        }

        await EnsureNoMalwareAsync(buffer.GetBuffer().AsMemory(0, (int)buffer.Length));

        var attachmentId = GuidGenerator.Create();
        var blobName = ChatAttachmentFiles.BlobName(conversation.ClinicBranchId, conversation.Id, attachmentId);
        // Only the sealed file ever reaches blob storage.
        var sealedFile = cipher.SealFile(buffer.GetBuffer().AsSpan(0, (int)buffer.Length), attachmentId);
        await blobContainer.SaveAsync(blobName, sealedFile, overrideExisting: true);

        var attachment = ChatAttachment.Upload(
            attachmentId, conversation.Id, CurrentUser.GetId(), blobName, fileName, contentType, buffer.Length, cipher);
        await attachments.InsertAsync(attachment, autoSave: true);
        return MapAttachment(attachment);
    }

    public async Task<ChatMessageDto> SendAsync(Guid id, SendChatMessageInput input)
    {
        var userId = CurrentUser.GetId();
        await GetVisibleAsync(id);

        var attachmentIds = input.AttachmentIds.Distinct().ToList();
        var files = attachmentIds.Count == 0
            ? []
            : await attachments.GetListAsync(a => attachmentIds.Contains(a.Id));
        if (files.Count != attachmentIds.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.AttachmentUnavailable);
        }

        var message = ChatMessage.Send(GuidGenerator.Create(), id, userId, input.Content, files.Count, Clock.Now, cipher);
        foreach (var file in files)
        {
            file.AttachTo(message.Id, id, userId);
        }

        await messages.InsertAsync(message);
        await attachments.UpdateManyAsync(files);

        // What you send, you have read.
        var member = await conversationManager.GetMemberAsync(id, userId);
        member.MarkRead(message.SentAt);
        await members.UpdateAsync(member, autoSave: true);

        await NotifyMembersAsync(id);
        return (await MapMessagesAsync([message], userId))[0];
    }

    public async Task<ChatMessageDto> EditMessageAsync(Guid messageId, EditChatMessageInput input)
    {
        var (message, conversation) = await GetVisibleMessageAsync(messageId);
        var replaced = message.Edit(
            CurrentUser.GetId(), input.Content, input.ExpectedEditedAt, Clock.Now, cipher,
            GuidGenerator.Create(), conversation.ClinicBranchId);
        if (replaced is not null)
        {
            await revisions.InsertAsync(replaced);
            await messages.UpdateAsync(message, autoSave: true);
            await NotifyMembersAsync(message.ConversationId);
        }

        return (await MapMessagesAsync([message], CurrentUser.GetId()))[0];
    }

    public async Task<List<ChatMessageRevisionDto>> GetMessageRevisionsAsync(Guid messageId)
    {
        var (message, _) = await GetVisibleMessageAsync(messageId);
        if (message.IsRecalled)
        {
            // A recall takes the history with it.
            return [];
        }

        var found = await AsyncExecuter.ToListAsync(
            (await revisions.GetQueryableAsync())
                .Where(r => r.MessageId == messageId)
                .OrderByDescending(r => r.EditedAt));
        return found.Select(r => new ChatMessageRevisionDto { Content = r.ReadContent(cipher), EditedAt = r.EditedAt }).ToList();
    }

    public async Task<ChatMessageDto> RecallMessageAsync(Guid messageId)
    {
        var (message, _) = await GetVisibleMessageAsync(messageId);
        message.Recall(CurrentUser.GetId(), Clock.Now);
        await messages.UpdateAsync(message, autoSave: true);
        await NotifyMembersAsync(message.ConversationId);
        return (await MapMessagesAsync([message], CurrentUser.GetId()))[0];
    }

    public async Task<IRemoteStreamContent> GetAttachmentAsync(Guid messageId, Guid attachmentId)
    {
        var (message, _) = await GetVisibleMessageAsync(messageId);
        var attachment = message.IsRecalled
            ? null
            : await attachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.MessageId == messageId);
        if (attachment is null)
        {
            throw new EntityNotFoundException(typeof(ChatAttachment), attachmentId);
        }

        var sealedFile = await blobContainer.GetAllBytesAsync(attachment.BlobName);
        var plain = cipher.OpenFile(sealedFile, attachment.Id);
        return new RemoteStreamContent(
            new MemoryStream(plain, writable: false), attachment.ReadFileName(cipher), attachment.ContentType);
    }

    public async Task<ChatUnreadCountDto> GetUnreadCountAsync()
    {
        var userId = CurrentUser.GetId();
        var mine = await MyConversationsQueryAsync(userId);
        var unread = await UnreadQueryAsync(userId);
        var count = await AsyncExecuter.CountAsync(unread.Where(m => mine.Any(c => c.Id == m.ConversationId)));
        return new ChatUnreadCountDto { Count = count };
    }

    /// <summary>The caller's conversations in the branch the picker shows (all they may open when none).</summary>
    private async Task<IQueryable<ChatConversation>> MyConversationsQueryAsync(Guid userId)
    {
        var memberQuery = await members.GetQueryableAsync();
        var query = (await conversations.GetQueryableAsync())
            .Where(c => memberQuery.Any(m => m.ConversationId == c.Id && m.UserId == userId));

        var branchIds = await branchAccess.ResolveFilterAsync(branchResolver.ClinicBranchId);
        return branchIds.Count > 0 ? query.Where(c => branchIds.Contains(c.ClinicBranchId)) : query;
    }

    /// <summary>Others' messages, not recalled, sent after the caller's read mark.</summary>
    private async Task<IQueryable<ChatMessage>> UnreadQueryAsync(Guid userId)
    {
        var memberQuery = await members.GetQueryableAsync();
        return from m in await messages.GetQueryableAsync()
               join member in memberQuery on m.ConversationId equals member.ConversationId
               where member.UserId == userId
                     && m.SenderId != userId
                     && m.RecalledAt == null
                     && m.SentAt > (member.LastReadAt ?? member.JoinedAt)
               select m;
    }

    private async Task<Guid> GetWriteBranchAsync()
    {
        var branchId = branchResolver.ClinicBranchId ?? branchResolver.OwnClinicBranchId
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Chat.BranchRequired);
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    /// <summary>A conversation the caller is not in, or may no longer open, does not exist for them.</summary>
    private async Task<ChatConversation> GetVisibleAsync(Guid id)
    {
        var userId = CurrentUser.GetId();
        var conversation = await conversations.FindAsync(id);
        if (conversation is null
            || !await members.AnyAsync(m => m.ConversationId == id && m.UserId == userId)
            || !await branchAccess.IsAllowedAsync(conversation.ClinicBranchId))
        {
            throw new EntityNotFoundException(typeof(ChatConversation), id);
        }

        return conversation;
    }

    private async Task<(ChatMessage Message, ChatConversation Conversation)> GetVisibleMessageAsync(Guid messageId)
    {
        var message = await messages.FindAsync(messageId)
            ?? throw new EntityNotFoundException(typeof(ChatMessage), messageId);
        return (message, await GetVisibleAsync(message.ConversationId));
    }

    private async Task NotifyMembersAsync(Guid conversationId) =>
        await notifier.NotifyAsync(conversationId, await conversationManager.GetMemberIdsAsync(conversationId));

    private async Task<ChatConversationDto> SummarizeOneAsync(ChatConversation conversation) =>
        (await SummarizeAsync([conversation], CurrentUser.GetId()))[0];

    private async Task<List<ChatConversationDto>> SummarizeAsync(List<ChatConversation> found, Guid userId)
    {
        if (found.Count == 0)
        {
            return [];
        }

        var ids = found.Select(c => c.Id).ToList();
        var memberRows = await members.GetListAsync(m => ids.Contains(m.ConversationId));

        var messageQuery = await messages.GetQueryableAsync();
        var latest = await AsyncExecuter.ToListAsync(messageQuery
            .Where(m => ids.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => g.OrderByDescending(m => m.SentAt).ThenByDescending(m => m.Id).First()));
        var latestMapped = (await MapMessagesAsync(latest, userId)).ToDictionary(m => m.ConversationId);

        var unread = await AsyncExecuter.ToListAsync((await UnreadQueryAsync(userId))
            .Where(m => ids.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => new { ConversationId = g.Key, Count = g.Count() }));
        var unreadById = unread.ToDictionary(u => u.ConversationId, u => u.Count);

        var names = await NamesAsync(memberRows.Select(m => m.UserId));

        return found.Select(c =>
        {
            var people = memberRows
                .Where(m => m.ConversationId == c.Id)
                .OrderBy(m => m.JoinedAt)
                .Select(m => new ChatMemberDto { UserId = m.UserId, FullName = NameOf(names, m.UserId) })
                .ToList();
            var last = latestMapped.GetValueOrDefault(c.Id);
            return new ChatConversationDto
            {
                Id = c.Id,
                ClinicBranchId = c.ClinicBranchId,
                Kind = c.Kind,
                Name = c.Name,
                OwnerId = c.OwnerId,
                IsOwnedByMe = c.IsOwnedBy(userId),
                Title = c.IsGroup
                    ? c.Name!
                    : people.FirstOrDefault(p => p.UserId != userId)?.FullName ?? NameOf(names, userId),
                Members = people,
                LastMessage = last,
                LastActivityAt = last?.SentAt ?? c.CreationTime,
                UnreadCount = unreadById.GetValueOrDefault(c.Id),
            };
        }).ToList();
    }

    private async Task<List<ChatMessageDto>> MapMessagesAsync(List<ChatMessage> page, Guid userId)
    {
        if (page.Count == 0)
        {
            return [];
        }

        // A recalled message keeps its place but none of what it carried.
        var withFiles = page.Where(m => !m.IsRecalled && m.AttachmentCount > 0).Select(m => m.Id).ToList();
        var files = withFiles.Count == 0
            ? []
            : await attachments.GetListAsync(a => a.MessageId != null && withFiles.Contains(a.MessageId.Value));
        var names = await NamesAsync(page.Select(m => m.SenderId));
        var now = Clock.Now;

        return page.Select(m => new ChatMessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            SenderName = NameOf(names, m.SenderId),
            IsMine = m.SenderId == userId,
            CanEdit = m.CanBeEditedBy(userId, now),
            EditableUntil = m.SenderId == userId && !m.IsRecalled ? m.EditableUntil : null,
            Content = m.ReadContent(cipher),
            SentAt = m.SentAt,
            EditedAt = m.IsRecalled ? null : m.EditedAt,
            IsRecalled = m.IsRecalled,
            Attachments = files
                .Where(f => f.MessageId == m.Id)
                .OrderBy(f => f.CreationTime)
                .Select(MapAttachment)
                .ToList(),
        }).ToList();
    }

    private async Task<Dictionary<Guid, string>> NamesAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds.Distinct().ToList();
        return ids.Count == 0
            ? []
            : (await userRepository.GetListByIdsAsync(ids)).ToDictionary(u => u.Id, FullName);
    }

    private static string NameOf(Dictionary<Guid, string> names, Guid userId) =>
        names.GetValueOrDefault(userId) ?? "—";

    private ChatAttachmentDto MapAttachment(ChatAttachment a) => new()
    {
        Id = a.Id,
        FileName = a.ReadFileName(cipher),
        ContentType = a.ContentType,
        SizeInBytes = a.SizeInBytes,
        IsImage = ChatAttachmentFiles.IsImage(a.ContentType),
    };

    private static bool MatchesAll(ChatConversationDto summary, IReadOnlyList<string> foldedTerms)
    {
        var haystack = SearchTerms.Fold(string.Join(" ", summary.Members.Select(m => m.FullName).Prepend(summary.Title)));
        return foldedTerms.All(haystack.Contains);
    }

    /// <summary>Reads one chunk past the cap at most, so an oversized upload is refused early.</summary>
    private static async Task<MemoryStream> ReadCappedAsync(Stream source)
    {
        var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > ChatConsts.MaxAttachmentBytes)
            {
                await buffer.DisposeAsync();
                throw new BusinessException(BlueDentalDomainErrorCodes.Chat.AttachmentTooLarge)
                    .WithData("max", ChatConsts.MaxAttachmentBytes / (1024 * 1024));
            }
        }

        return buffer;
    }

    /// <summary>
    /// Fails closed: when clamd is configured but does not answer, nothing is
    /// stored. Only a machine with no scanner configured lets files through.
    /// The log names the account and signature, never the file name.
    /// </summary>
    private async Task EnsureNoMalwareAsync(ReadOnlyMemory<byte> content)
    {
        var result = await malwareScanner.ScanAsync(content);
        switch (result.Verdict)
        {
            case MalwareScanVerdict.Infected:
                Logger.LogWarning("Chat: upload by {UserId} refused, malware {Signature}.", CurrentUser.Id, result.Signature);
                throw new BusinessException(BlueDentalDomainErrorCodes.Chat.AttachmentInfected);
            case MalwareScanVerdict.Unavailable:
                throw new BusinessException(BlueDentalDomainErrorCodes.Chat.MalwareScanUnavailable);
        }
    }

    private static BusinessException InvalidAttachment() =>
        new(BlueDentalDomainErrorCodes.Chat.InvalidAttachment);

    private static string FullName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}

/// <summary>Stands in where no SignalR host runs (tests, the migrator).</summary>
[Volo.Abp.DependencyInjection.Dependency(TryRegister = true)]
public class NullChatNotifier : IChatNotifier, Volo.Abp.DependencyInjection.ITransientDependency
{
    public Task NotifyAsync(Guid conversationId, IReadOnlyCollection<Guid> userIds) => Task.CompletedTask;
}
