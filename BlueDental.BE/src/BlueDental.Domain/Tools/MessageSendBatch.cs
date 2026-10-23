using System;
using BlueDental.CustomerCare;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

/// <summary>
/// One "Gửi" of CSKH ▸ Gửi tin nhắn (BA P2110, F-77): one template over one
/// channel to a set of customers, now or at "Hẹn giờ gửi".
///
/// Each customer is a <see cref="MessageLog"/> of the batch, written Pending
/// when the batch is created; the background job sends them one by one, so
/// what happened to each is read off its log, not kept here.
/// </summary>
public class MessageSendBatch : CreationAuditedAggregateRoot<Guid>
{
    public const int MaxTemplateNameLength = MessageLog.MaxTemplateNameLength;

    public Guid ClinicBranchId { get; private set; }
    public MessageChannelType Channel { get; private set; }
    public Guid TemplateId { get; private set; }

    /// <summary>The template's name when the send was made; a later rename leaves history alone.</summary>
    public string TemplateName { get; private set; } = string.Empty;

    public MessageRecipientSource Source { get; private set; }

    /// <summary>The CSKH tab of a <see cref="MessageRecipientSource.CareList"/> send.</summary>
    public CareType? CareType { get; private set; }

    /// <summary>The period the tab was read over (UTC).</summary>
    public DateTime? FromDate { get; private set; }
    public DateTime? ToDate { get; private set; }

    /// <summary>"Bỏ qua khách đã nhận mẫu này trong 30 ngày".</summary>
    public bool SkipRecentDuplicates { get; private set; }

    /// <summary>"Hẹn giờ gửi" (UTC); null sends at once.</summary>
    public DateTime? ScheduledAt { get; private set; }

    public MessageSendBatchStatus Status { get; private set; }

    /// <summary>Messages the batch holds — one log per customer.</summary>
    public int RecipientCount { get; private set; }

    /// <summary>Customers of the list left out when the batch was made (no contact, sent recently, missing variable, …).</summary>
    public int SkippedCount { get; private set; }

    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    private MessageSendBatch() { }

    /// <summary>
    /// A template goes out only on its own channel, from its own branch, once
    /// it is "Sẵn sàng"; a scheduled time must still be ahead.
    /// </summary>
    public static MessageSendBatch Create(
        Guid id,
        Guid clinicBranchId,
        MessageTemplate template,
        MessageSendRecipients recipients,
        bool skipRecentDuplicates,
        DateTime? scheduledAt,
        DateTime now)
    {
        if (template.ClinicBranchId != clinicBranchId || !template.CanSend)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        }

        if (recipients.Source == MessageRecipientSource.CareList
            && (recipients.CareType is not { } type || !CareBoard.IsTab(type)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendListRequired);
        }

        if (recipients.Count <= 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendNoRecipients);
        }

        if (scheduledAt.HasValue && scheduledAt.Value <= now)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendScheduleInPast);
        }

        return new MessageSendBatch
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Channel = template.Channel,
            TemplateId = template.Id,
            TemplateName = Clip(template.Name, MaxTemplateNameLength),
            Source = recipients.Source,
            CareType = recipients.Source == MessageRecipientSource.CareList ? recipients.CareType : null,
            FromDate = recipients.Source == MessageRecipientSource.CareList ? recipients.FromDate : null,
            ToDate = recipients.Source == MessageRecipientSource.CareList ? recipients.ToDate : null,
            SkipRecentDuplicates = skipRecentDuplicates,
            ScheduledAt = scheduledAt,
            Status = MessageSendBatchStatus.Queued,
            RecipientCount = recipients.Count,
            SkippedCount = Math.Max(0, recipients.Skipped),
        };
    }

    public bool IsDue(DateTime now) =>
        Status == MessageSendBatchStatus.Queued && (ScheduledAt == null || ScheduledAt <= now);

    /// <summary>
    /// The job takes the batch. One already sending is taken again — the host
    /// stopped half-way and the job came back for the rest. False when there
    /// is nothing to send: it was called off, or finished.
    /// </summary>
    public bool TryStart(DateTime now)
    {
        if (Status == MessageSendBatchStatus.Sending)
        {
            return true;
        }

        if (!IsDue(now))
        {
            return false;
        }

        Status = MessageSendBatchStatus.Sending;
        StartedAt = now;
        return true;
    }

    public void Complete(DateTime now)
    {
        if (Status != MessageSendBatchStatus.Sending)
        {
            return;
        }

        Status = MessageSendBatchStatus.Completed;
        CompletedAt = now;
    }

    /// <summary>"Huỷ hẹn gửi" — only before the job has started on it.</summary>
    public void Cancel(DateTime now)
    {
        if (Status != MessageSendBatchStatus.Queued)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        }

        Status = MessageSendBatchStatus.Cancelled;
        CancelledAt = now;
    }

    /// <summary>
    /// "Tạm dừng" of Chiến dịch đã gửi (BA P2210, F-79). A batch still waiting
    /// is called off as "Huỷ hẹn gửi" is; one sending stops where it is — what
    /// went stays sent (Zalo cannot recall a ZNS), the rest never goes, and
    /// there is no going on with it afterwards.
    /// </summary>
    public void Stop(DateTime now)
    {
        if (Status == MessageSendBatchStatus.Queued)
        {
            Cancel(now);
            return;
        }

        if (Status != MessageSendBatchStatus.Sending)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendNotCancellable);
        }

        Status = MessageSendBatchStatus.Stopped;
        CancelledAt = now;
    }

    /// <summary>Called off before or while sending — its waiting messages will never go.</summary>
    public bool IsCalledOff => Status is MessageSendBatchStatus.Cancelled or MessageSendBatchStatus.Stopped;

    private static string Clip(string value, int max) => value.Length <= max ? value : value[..max];
}

/// <summary>Who a batch goes to: where the list came from and how many made it in.</summary>
public sealed record MessageSendRecipients(
    MessageRecipientSource Source,
    CareType? CareType,
    DateTime? FromDate,
    DateTime? ToDate,
    int Count,
    int Skipped);
