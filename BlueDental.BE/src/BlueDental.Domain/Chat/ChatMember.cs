using System;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Chat;

/// <summary>
/// A person in a <see cref="ChatConversation"/>, and how far they have read.
/// A plain row without a concurrency stamp: only its own person moves the read
/// mark, and a later mark simply wins, so two open tabs never conflict.
/// </summary>
public class ChatMember : Entity<Guid>
{
    public Guid ConversationId { get; private set; }

    public Guid UserId { get; private set; }

    public DateTime JoinedAt { get; private set; }

    /// <summary>Messages sent after this are unread; null until the first read.</summary>
    public DateTime? LastReadAt { get; private set; }

    protected ChatMember() { }

    internal ChatMember(Guid id, Guid conversationId, Guid userId, DateTime joinedAt) : base(id)
    {
        ConversationId = conversationId;
        UserId = userId;
        JoinedAt = joinedAt;
    }

    /// <summary>Unread counts start here: what came before joining is not news to them.</summary>
    public DateTime ReadUpTo => LastReadAt ?? JoinedAt;

    /// <summary>Moves the mark forward only; an older read arriving late changes nothing.</summary>
    public bool MarkRead(DateTime at)
    {
        if (LastReadAt is not null && at <= LastReadAt)
        {
            return false;
        }

        LastReadAt = at;
        return true;
    }
}
