using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace BlueDental.Chat;

/// <summary>
/// Starts conversations and changes who is in them (F-89). Holds the rules
/// that span a conversation and its member rows: everyone has to pass
/// <see cref="ChatParticipantPolicy"/>, a group starts with somebody besides
/// its creator and never grows past <see cref="ChatConsts.MaxGroupMembers"/>,
/// and only members may bring others in. Anyone may start a group (owner
/// 2026-11-06), and any member may rename it or add people.
/// </summary>
public class ChatConversationManager : DomainService
{
    private readonly IRepository<ChatConversation, Guid> _conversations;
    private readonly IRepository<ChatMember, Guid> _members;
    private readonly ChatParticipantPolicy _policy;

    public ChatConversationManager(
        IRepository<ChatConversation, Guid> conversations,
        IRepository<ChatMember, Guid> members,
        ChatParticipantPolicy policy)
    {
        _conversations = conversations;
        _members = members;
        _policy = policy;
    }

    /// <summary>The pair's thread in the branch, started when there is none yet.</summary>
    public async Task<ChatConversation> OpenDirectAsync(Guid clinicBranchId, Guid starterId, Guid otherId)
    {
        var key = ChatConversation.DirectKeyOf(starterId, otherId);
        var existing = await _conversations.FirstOrDefaultAsync(c => c.ClinicBranchId == clinicBranchId && c.DirectKey == key);
        if (existing is not null)
        {
            return existing;
        }

        var conversation = ChatConversation.CreateDirect(GuidGenerator.Create(), clinicBranchId, starterId, otherId);
        await _policy.EnsureEligibleAsync(clinicBranchId, [starterId, otherId]);
        await _conversations.InsertAsync(conversation, autoSave: true);
        await InsertMembersAsync(conversation.Id, [starterId, otherId]);
        return conversation;
    }

    public async Task<ChatConversation> CreateGroupAsync(
        Guid clinicBranchId, string name, Guid creatorId, IEnumerable<Guid> memberIds)
    {
        var others = memberIds.Where(m => m != Guid.Empty && m != creatorId).Distinct().ToList();
        if (others.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.GroupNeedsMembers);
        }

        EnsureRoom(0, others.Count + 1);
        var conversation = ChatConversation.CreateGroup(GuidGenerator.Create(), clinicBranchId, name, creatorId);
        List<Guid> everyone = [creatorId, .. others];
        await _policy.EnsureEligibleAsync(clinicBranchId, everyone);
        await _conversations.InsertAsync(conversation, autoSave: true);
        await InsertMembersAsync(conversation.Id, everyone);
        return conversation;
    }

    /// <summary>People already in the group are skipped; returns who was added.</summary>
    public async Task<IReadOnlyList<Guid>> AddMembersAsync(ChatConversation conversation, Guid actorId, IEnumerable<Guid> userIds)
    {
        conversation.EnsureGroup();
        var current = await GetMemberIdsAsync(conversation.Id);
        if (!current.Contains(actorId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.NotMember);
        }

        var added = userIds.Where(u => u != Guid.Empty && !current.Contains(u)).Distinct().ToList();
        if (added.Count == 0)
        {
            return added;
        }

        EnsureRoom(current.Count, added.Count);
        await _policy.EnsureEligibleAsync(conversation.ClinicBranchId, added);
        await InsertMembersAsync(conversation.Id, added);
        return added;
    }

    /// <summary>When the owner leaves, whoever has been in the group longest takes over.</summary>
    public async Task LeaveAsync(ChatConversation conversation, Guid userId)
    {
        conversation.EnsureGroup();
        var member = await GetMemberAsync(conversation.Id, userId);
        await _members.DeleteAsync(member, autoSave: true);

        if (conversation.IsOwnedBy(userId))
        {
            var query = (await _members.GetQueryableAsync())
                .Where(m => m.ConversationId == conversation.Id)
                .OrderBy(m => m.JoinedAt)
                .ThenBy(m => m.Id)
                .Select(m => (Guid?)m.UserId);
            conversation.HandOverOwnership(await AsyncExecuter.FirstOrDefaultAsync(query));
            await _conversations.UpdateAsync(conversation, autoSave: true);
        }
    }

    /// <summary>Only the owner removes people, and not themself: leaving is how they go.</summary>
    public async Task RemoveMemberAsync(ChatConversation conversation, Guid actorId, Guid userId)
    {
        conversation.EnsureGroup();
        if (!conversation.IsOwnedBy(actorId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.NotGroupOwner);
        }

        if (userId == actorId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.CannotRemoveSelf);
        }

        var member = await GetMemberAsync(conversation.Id, userId);
        await _members.DeleteAsync(member, autoSave: true);
    }

    public async Task<ChatMember> GetMemberAsync(Guid conversationId, Guid userId) =>
        await _members.FirstOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == userId)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.Chat.NotMember);

    public async Task<List<Guid>> GetMemberIdsAsync(Guid conversationId)
    {
        var query = await _members.GetQueryableAsync();
        return await AsyncExecuter.ToListAsync(query.Where(m => m.ConversationId == conversationId).Select(m => m.UserId));
    }

    private async Task InsertMembersAsync(Guid conversationId, IEnumerable<Guid> userIds)
    {
        var now = Clock.Now;
        await _members.InsertManyAsync(userIds.Select(u => new ChatMember(GuidGenerator.Create(), conversationId, u, now)), autoSave: true);
    }

    private static void EnsureRoom(int current, int adding)
    {
        if (current + adding > ChatConsts.MaxGroupMembers)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.TooManyMembers)
                .WithData("max", ChatConsts.MaxGroupMembers);
        }
    }
}
