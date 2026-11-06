using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Chat;

/// <summary>
/// One thread of Chat nội bộ (F-89, BlueDental-local).
///
/// A conversation belongs to the branch it was started in, and for now every
/// member has to be able to work there (<see cref="ChatParticipantPolicy"/>).
/// Reading is decided by membership alone, so letting people of other branches
/// in later only changes that policy, not this aggregate or its data.
///
/// Members and their read marks are rows of their own (<see cref="ChatMember"/>)
/// and the thread's latest activity is its newest message: sending and reading
/// never rewrite this row, so two people typing at once cannot collide on it.
/// </summary>
public class ChatConversation : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public ChatConversationKind Kind { get; private set; }

    /// <summary>Group name; null for a two-person conversation.</summary>
    public string? Name { get; private set; }

    /// <summary>
    /// "smaller-guid:larger-guid" for a two-person conversation, so the same
    /// pair always lands in the same thread of a branch; null for a group.
    /// </summary>
    public string? DirectKey { get; private set; }

    protected ChatConversation() { }

    public bool IsGroup => Kind == ChatConversationKind.Group;

    public static string DirectKeyOf(Guid a, Guid b)
    {
        var (first, second) = a.CompareTo(b) <= 0 ? (a, b) : (b, a);
        return $"{first}:{second}";
    }

    public static ChatConversation CreateDirect(Guid id, Guid clinicBranchId, Guid starterId, Guid otherId)
    {
        RequireBranch(clinicBranchId);
        if (starterId == otherId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.DirectWithSelf);
        }

        return new ChatConversation
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Kind = ChatConversationKind.Direct,
            DirectKey = DirectKeyOf(starterId, otherId),
        };
    }

    public static ChatConversation CreateGroup(Guid id, Guid clinicBranchId, string name)
    {
        RequireBranch(clinicBranchId);
        return new ChatConversation
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Kind = ChatConversationKind.Group,
            Name = NormalizeName(name),
        };
    }

    public void Rename(string name)
    {
        EnsureGroup();
        Name = NormalizeName(name);
    }

    /// <summary>Renaming, adding people and leaving are for groups only.</summary>
    public void EnsureGroup()
    {
        if (!IsGroup)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.GroupOnly);
        }
    }

    private static void RequireBranch(Guid clinicBranchId)
    {
        if (clinicBranchId == Guid.Empty)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.BranchRequired);
        }
    }

    private static string NormalizeName(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.GroupNameRequired);
        }

        if (trimmed.Length > ChatConsts.MaxGroupNameLength)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.GroupNameTooLong)
                .WithData("max", ChatConsts.MaxGroupNameLength);
        }

        return trimmed;
    }
}
