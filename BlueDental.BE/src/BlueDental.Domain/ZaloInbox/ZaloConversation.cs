using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.ZaloInbox;

/// <summary>
/// One Zalo user talking to the branch's OA — a row of CSKH ▸ Hộp thư Zalo
/// (BA P2210, F-79). Its messages are <see cref="ZaloChatMessage"/> rows; this
/// keeps what the list shows: the last message, Chưa trả lời / Đã chăm sóc,
/// who holds it and the free-text tags.
///
/// "Nhận xử lý" holds the conversation for one staff member, who alone may
/// answer it. The hold runs <see cref="ZaloInboxConsts.HoldMinutes"/> minutes
/// from taking it or from the holder's last answer; past that the conversation
/// is free again without anyone clearing it, so a lapsed holder is read as none.
/// </summary>
public class ZaloConversation : FullAuditedAggregateRoot<Guid>
{
    public const int MaxZaloUserIdLength = 50;
    public const int MaxNameLength = 200;
    public const int MaxUrlLength = 1000;
    public const int MaxPhoneLength = 30;
    public const int MaxPreviewLength = 200;

    public static readonly TimeSpan HoldDuration = TimeSpan.FromMinutes(ZaloInboxConsts.HoldMinutes);
    public static readonly TimeSpan ReplyWindow = TimeSpan.FromHours(ZaloInboxConsts.ReplyWindowHours);

    private List<string> _tags = [];

    public Guid ClinicBranchId { get; private set; }

    /// <summary>Zalo's <c>user_id</c> of the customer, as seen by this OA.</summary>
    public string ZaloUserId { get; private set; } = string.Empty;

    public string DisplayName { get; private set; } = string.Empty;

    public string? AvatarUrl { get; private set; }

    /// <summary>The phone the customer shared with the OA (<c>shared_info.phone</c>), when they did.</summary>
    public string? SharedPhone { get; private set; }

    /// <summary>The branch's patient record this customer is.</summary>
    public Guid? PatientId { get; private set; }

    public ZaloConversationStatus Status { get; private set; } = ZaloConversationStatus.Cared;

    public DateTime? LastMessageAt { get; private set; }

    public string? LastMessagePreview { get; private set; }

    public ZaloChatDirection? LastMessageDirection { get; private set; }

    public DateTime? LastCustomerMessageAt { get; private set; }

    public DateTime? LastReplyAt { get; private set; }

    public Guid? HolderId { get; private set; }

    public DateTime? HeldUntil { get; private set; }

    public IReadOnlyList<string> Tags => _tags.AsReadOnly();

    protected ZaloConversation() { }

    public static ZaloConversation Open(
        Guid id, Guid clinicBranchId, string zaloUserId, string? displayName, string? avatarUrl, string? sharedPhone)
    {
        if (clinicBranchId == Guid.Empty)
        {
            throw new ArgumentException("A conversation belongs to a branch.", nameof(clinicBranchId));
        }

        var conversation = new ZaloConversation
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            ZaloUserId = Check.NotNullOrWhiteSpace(zaloUserId, nameof(zaloUserId), MaxZaloUserIdLength).Trim(),
        };
        conversation.SetProfile(displayName, avatarUrl, sharedPhone);
        return conversation;
    }

    /// <summary>What Zalo says of the user; a blank name falls back to the end of their id.</summary>
    public void SetProfile(string? displayName, string? avatarUrl, string? sharedPhone)
    {
        DisplayName = Clip(
            string.IsNullOrWhiteSpace(displayName) ? $"Zalo …{ZaloUserId[^Math.Min(4, ZaloUserId.Length)..]}" : displayName.Trim(),
            MaxNameLength)!;
        AvatarUrl = Clip(Blank(avatarUrl), MaxUrlLength);
        SharedPhone = Clip(Blank(sharedPhone), MaxPhoneLength) ?? SharedPhone;
    }

    public void LinkPatient(Guid? patientId) =>
        PatientId = patientId == Guid.Empty ? null : patientId;

    /// <summary>
    /// A message of the chat, in whatever order they arrive: the webhook brings
    /// them live, a sync brings older ones. Last message and status follow the
    /// newest of each side, never the order they were recorded in.
    /// </summary>
    public void RecordMessage(ZaloChatDirection direction, DateTime at, string preview)
    {
        if (LastMessageAt == null || at >= LastMessageAt)
        {
            LastMessageAt = at;
            LastMessagePreview = Clip(preview, MaxPreviewLength);
            LastMessageDirection = direction;
        }

        if (direction == ZaloChatDirection.Inbound)
        {
            LastCustomerMessageAt = Latest(LastCustomerMessageAt, at);
        }
        else
        {
            LastReplyAt = Latest(LastReplyAt, at);
        }

        // Answered means an OA message after the customer's last one; a
        // conversation the OA opened (a ZNS, a broadcast) has nothing to answer.
        Status = LastCustomerMessageAt is { } asked && (LastReplyAt is not { } answered || asked > answered)
            ? ZaloConversationStatus.Unreplied
            : ZaloConversationStatus.Cared;
    }

    /// <summary>The holder's answer keeps the hold for another 15 minutes.</summary>
    public void RecordReply(Guid userId, DateTime at, string preview, DateTime now)
    {
        EnsureHeldBy(userId, now);
        RecordMessage(ZaloChatDirection.Outbound, at, preview);
        HeldUntil = now + HoldDuration;
    }

    public Guid? HolderAt(DateTime now) => HeldUntil > now ? HolderId : null;

    public bool IsHeldBy(Guid userId, DateTime now) => HolderAt(now) == userId;

    /// <summary>"Nhận xử lý". Taking it again renews the hold; someone else's live hold refuses.</summary>
    public void Claim(Guid userId, DateTime now)
    {
        if (HolderAt(now) is { } holder && holder != userId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.HeldByOther);
        }

        HolderId = userId;
        HeldUntil = now + HoldDuration;
    }

    /// <summary>"Nhả hội thoại": back to "Nhận xử lý" for everyone.</summary>
    public void Release(Guid userId, DateTime now)
    {
        EnsureHeldBy(userId, now);
        HolderId = null;
        HeldUntil = null;
    }

    /// <summary>"Chuyển cho người khác": the colleague holds it from now, for the same 15 minutes.</summary>
    public void TransferTo(Guid fromUserId, Guid toUserId, DateTime now)
    {
        EnsureHeldBy(fromUserId, now);
        if (toUserId == fromUserId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.TransferToSelf);
        }

        HolderId = toUserId;
        HeldUntil = now + HoldDuration;
    }

    public void EnsureHeldBy(Guid userId, DateTime now)
    {
        if (!IsHeldBy(userId, now))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.NotHolder);
        }
    }

    /// <summary>When Zalo stops taking a "tin tư vấn": 48 hours after the customer last wrote.</summary>
    public DateTime? ReplyWindowEndsAt => LastCustomerMessageAt + ReplyWindow;

    public bool CanReplyFreely(DateTime now) => ReplyWindowEndsAt > now;

    public void EnsureCanReplyFreely(DateTime now)
    {
        if (!CanReplyFreely(now))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.ReplyWindowClosed)
                .WithData("hours", ZaloInboxConsts.ReplyWindowHours);
        }
    }

    /// <summary>
    /// Free text (BA P2210: "Cái tag này cho nhập free text"). Spaces are
    /// tidied, blanks dropped, and the same tag in another case kept once.
    /// </summary>
    public void SetTags(IEnumerable<string?> tags)
    {
        var tidy = new List<string>();
        foreach (var raw in tags)
        {
            var tag = string.Join(' ', (raw ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
            if (tag.Length == 0 || tidy.Contains(tag, StringComparer.CurrentCultureIgnoreCase))
            {
                continue;
            }

            if (tag.Length > ZaloInboxConsts.MaxTagLength)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.TagTooLong)
                    .WithData("max", ZaloInboxConsts.MaxTagLength);
            }

            tidy.Add(tag);
        }

        if (tidy.Count > ZaloInboxConsts.MaxTags)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.TooManyTags)
                .WithData("max", ZaloInboxConsts.MaxTags);
        }

        _tags = tidy;
    }

    private static DateTime Latest(DateTime? current, DateTime at) =>
        current is { } known && known > at ? known : at;

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}
