using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Chiến dịch đã gửi (BA P2210, F-79): the current branch's sends of
/// Gửi tin nhắn and "Kết quả lần gửi" of each.
///
/// A send's customers are its <see cref="MessageLog"/> rows: the messages,
/// and — from F-79 on — those left out before it went. A failed message
/// keeps no time of its own, so it is shown at the time its send started.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhSend.Read)]
public class MessageCampaignAppService(
    IRepository<MessageSendBatch, Guid> batches,
    IRepository<MessageLog, Guid> messages,
    MessageBatchCounter counter,
    IMessageSendStopper stopper,
    MessageSenderNames senderNames,
    PatientPhoneMasker phoneMasker,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IMessageCampaignAppService
{
    /// <summary>A file holds this many customers at most.</summary>
    private const int MaxExportRows = 50_000;

    public async Task<PagedResultDto<MessageCampaignDto>> GetListAsync(MessageCampaignPagedInput input)
    {
        var branchId = await GetBranchIdAsync();
        var query = (await batches.GetQueryableAsync())
            .Where(b => b.ClinicBranchId == branchId)
            .OrderByDescending(b => b.CreationTime)
            .ThenByDescending(b => b.Id);
        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.Skip(input.SkipCount).Take(input.MaxResultCount));

        var counts = await counter.CountAsync([.. page.Select(b => b.Id)]);
        var customers = await SoleCustomersAsync(page);
        return new PagedResultDto<MessageCampaignDto>(total, [.. page.Select(b =>
            Fill(new MessageCampaignDto(), b, counts.GetValueOrDefault(b.Id), customers.GetValueOrDefault(b.Id)))]);
    }

    public async Task<MessageCampaignDetailDto> GetAsync(Guid id)
    {
        var batch = await GetBatchAsync(id);
        var rows = (await messages.GetQueryableAsync()).Where(m => m.SendBatchId == id);
        var byStatus = await AsyncExecuter.ToListAsync(rows
            .GroupBy(m => m.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() }));
        var charged = await AsyncExecuter.ToListAsync(rows
            .Where(m => MessageTemplateUsageReader.Delivered.Contains(m.Status) && m.Cost != null)
            .Select(m => m.Cost!.Value));
        var failures = await AsyncExecuter.ToListAsync(rows
            .Where(m => m.Status == MessageSendStatus.Failed)
            .GroupBy(m => m.ErrorMessage)
            .Select(g => new { Error = g.Key, Count = g.Count() }));
        var skips = await AsyncExecuter.ToListAsync(rows
            .Where(m => m.Status == MessageSendStatus.Skipped)
            .GroupBy(m => m.SkipReason)
            .Select(g => new { Reason = g.Key, Count = g.Count() }));
        var externalTemplateId = await AsyncExecuter.FirstOrDefaultAsync(rows
            .Where(m => m.ExternalTemplateId != null)
            .Select(m => m.ExternalTemplateId));

        int CountOf(params MessageSendStatus[] statuses) =>
            byStatus.Where(s => statuses.Contains(s.Status)).Sum(s => s.Count);

        var counts = new MessageBatchCounts(
            CountOf(MessageTemplateUsageReader.Delivered),
            CountOf(MessageSendStatus.Failed),
            CountOf(MessageSendStatus.Pending),
            CountOf(MessageSendStatus.Stopped));
        var senders = await senderNames.LoadAsync([batch.CreatorId]);
        var detail = Fill(new MessageCampaignDetailDto(), batch, counts, (await SoleCustomersAsync([batch])).GetValueOrDefault(batch.Id));
        detail.ExternalTemplateId = externalTemplateId;
        detail.SenderName = batch.CreatorId is { } creator ? senders.GetValueOrDefault(creator) : null;
        detail.StartedAt = batch.StartedAt;
        detail.CompletedAt = batch.CompletedAt;
        detail.CancelledAt = batch.CancelledAt;
        detail.DeliveredCount = CountOf(MessageSendStatus.Delivered);
        detail.ChargedCount = charged.Count;
        detail.Cost = charged.Sum();
        detail.PricePerMessage = charged.Count > 0 && charged.Min() == charged.Max() ? charged[0] : null;
        detail.Tabs = new MessageCampaignTabsDto
        {
            All = byStatus.Sum(s => s.Count),
            Succeeded = counts.Sent,
            Failed = counts.Failed,
            Skipped = CountOf(MessageSendStatus.Skipped),
        };

        var reasons = failures
            .GroupBy(f => MessageFailureReasons.Describe(f.Error, L) ?? L["CSKH:Campaign:Detail:Failed"].Value)
            .Select(g => new MessageCampaignReasonDto
            {
                Outcome = MessageCampaignOutcome.Failed,
                Label = g.Key,
                Count = g.Sum(f => f.Count),
            })
            .Concat(skips.Select(s => new MessageCampaignReasonDto
            {
                Outcome = MessageCampaignOutcome.Skipped,
                SkipReason = s.Reason,
                Label = SkipLabel(s.Reason),
                Count = s.Count,
            }))
            .ToList();

        // A send made before F-79 kept no row for those it left out: they stay one unexplained figure.
        var unrecorded = batch.SkippedCount - detail.Tabs.Skipped;
        if (unrecorded > 0)
        {
            reasons.Add(new MessageCampaignReasonDto
            {
                Outcome = MessageCampaignOutcome.Skipped,
                Label = SkipLabel(null),
                Count = unrecorded,
            });
        }

        detail.Reasons = [.. reasons
            .OrderByDescending(r => r.Count)
            .ThenBy(r => r.Outcome)
            .ThenBy(r => r.Label, StringComparer.CurrentCultureIgnoreCase)];
        return detail;
    }

    public async Task<PagedResultDto<MessageCampaignRecipientDto>> GetRecipientsAsync(
        Guid id, GetMessageCampaignRecipientsInput input)
    {
        var batch = await GetBatchAsync(id);
        var query = RecipientQuery(await messages.GetQueryableAsync(), id, input.Outcome);
        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.Skip(input.SkipCount).Take(input.MaxResultCount));

        // The API's response filter masks the phones for a "Ẩn số điện thoại" viewer.
        return new PagedResultDto<MessageCampaignRecipientDto>(total, await ToRecipientDtosAsync(batch, page));
    }

    /// <summary>
    /// Anyone who may send may stop any send of the branch. The batch is
    /// saved first, so the job — which sends only while its batch is
    /// sending — finds it stopped, then the waiting messages are turned off.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhSend.Create)]
    public async Task<MessageCampaignDto> StopAsync(Guid id)
    {
        var batch = await GetBatchAsync(id);
        batch.Stop(Clock.Now);
        await batches.UpdateAsync(batch, autoSave: true);
        await stopper.StopWaitingAsync(id);

        var counts = await counter.CountAsync([id]);
        var customers = await SoleCustomersAsync([batch]);
        return Fill(new MessageCampaignDto(), batch, counts.GetValueOrDefault(id), customers.GetValueOrDefault(id));
    }

    public async Task<byte[]> ExportFailuresAsync(Guid id)
    {
        var batch = await GetBatchAsync(id);
        var logs = await messages.GetQueryableAsync();
        var failed = RecipientQuery(logs, id, MessageCampaignOutcome.Failed);
        var skipped = RecipientQuery(logs, id, MessageCampaignOutcome.Skipped);
        var rows = await ToRecipientDtosAsync(batch, [
            .. await AsyncExecuter.ToListAsync(failed.Take(MaxExportRows)),
            .. await AsyncExecuter.ToListAsync(skipped.Take(MaxExportRows)),
        ]);

        // A file leaves the API without the response filter: mask it here (Cụm 11 mục 9).
        await phoneMasker.MaskIfRequiredAsync(rows);

        return new MessageCampaignExcel(L, batch).Build(rows);
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    private async Task<MessageSendBatch> GetBatchAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await batches.FirstOrDefaultAsync(b => b.Id == id && b.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(MessageSendBatch), id);
    }

    /// <summary>The customers of one tab: those it tried first, then those still waiting, stopped, left out; by name within.</summary>
    private static IQueryable<MessageLog> RecipientQuery(IQueryable<MessageLog> logs, Guid batchId, MessageCampaignOutcome? outcome)
    {
        var query = logs.Where(m => m.SendBatchId == batchId);
        query = outcome switch
        {
            MessageCampaignOutcome.Succeeded => query.Where(m => MessageTemplateUsageReader.Delivered.Contains(m.Status)),
            MessageCampaignOutcome.Failed => query.Where(m => m.Status == MessageSendStatus.Failed),
            MessageCampaignOutcome.Skipped => query.Where(m => m.Status == MessageSendStatus.Skipped),
            MessageCampaignOutcome.Pending => query.Where(m => m.Status == MessageSendStatus.Pending),
            MessageCampaignOutcome.Stopped => query.Where(m => m.Status == MessageSendStatus.Stopped),
            _ => query,
        };

        return query
            .OrderBy(m => m.Status == MessageSendStatus.Skipped ? 3
                : m.Status == MessageSendStatus.Stopped ? 2
                : m.Status == MessageSendStatus.Pending ? 1
                : 0)
            .ThenBy(m => m.RecipientName)
            .ThenBy(m => m.Id);
    }

    private async Task<List<MessageCampaignRecipientDto>> ToRecipientDtosAsync(MessageSendBatch batch, List<MessageLog> page)
    {
        if (page.Count == 0)
        {
            return [];
        }

        var ids = page.Select(m => m.Id).ToList();
        var carrierIds = page.Select(m => m.MergedIntoMessageId).OfType<Guid>().Distinct().ToList();
        var logs = await messages.GetQueryableAsync();
        var sharedWith = (await AsyncExecuter.ToListAsync(logs
                .Where(m => m.MergedIntoMessageId != null && ids.Contains(m.MergedIntoMessageId.Value))
                .GroupBy(m => m.MergedIntoMessageId!.Value)
                .Select(g => new { CarrierId = g.Key, Count = g.Count() })))
            .ToDictionary(r => r.CarrierId, r => r.Count);
        var carriers = (await AsyncExecuter.ToListAsync(logs
                .Where(m => carrierIds.Contains(m.Id))
                .Select(m => new { m.Id, m.RecipientName })))
            .ToDictionary(r => r.Id, r => r.RecipientName);

        return [.. page.Select(m =>
        {
            var outcome = OutcomeOf(m.Status);
            var detail = outcome switch
            {
                MessageCampaignOutcome.Succeeded => L[m.Status == MessageSendStatus.Delivered
                    ? "CSKH:Campaign:Detail:Delivered"
                    : "CSKH:Campaign:Detail:Sent"].Value,
                MessageCampaignOutcome.Failed => MessageFailureReasons.Describe(m.ErrorMessage, L)
                    ?? L["CSKH:Campaign:Detail:Failed"].Value,
                MessageCampaignOutcome.Skipped => m.MergedIntoMessageId is { } carrier
                    ? L["CSKH:Campaign:Skip:MergedInto", carriers.GetValueOrDefault(carrier) ?? string.Empty].Value
                    : SkipLabel(m.SkipReason),
                MessageCampaignOutcome.Pending => L["CSKH:Campaign:Detail:Pending"].Value,
                _ => L["CSKH:Campaign:Detail:Stopped"].Value,
            };

            // One message to a phone several customers share (R05): it went for all of them.
            if (outcome != MessageCampaignOutcome.Skipped && sharedWith.GetValueOrDefault(m.Id) is > 0 and var merged)
            {
                detail += " · " + L["CSKH:Campaign:Detail:Shared", merged + 1].Value;
            }

            // BA P2210: a message Zalo refused costs nothing (0 đ); one never sent has no cost at all (—).
            var charged = outcome switch
            {
                MessageCampaignOutcome.Succeeded => m.Cost,
                MessageCampaignOutcome.Failed => 0m,
                _ => null,
            };
            return new MessageCampaignRecipientDto
            {
                Id = m.Id,
                PatientId = m.PatientId,
                Name = m.RecipientName,
                Phone = string.IsNullOrWhiteSpace(m.RecipientPhone) ? null : ZaloPhoneNumber.ToLocal(m.RecipientPhone),
                Outcome = outcome,
                Detail = detail,
                At = m.SentAt ?? (outcome == MessageCampaignOutcome.Failed ? batch.StartedAt : null),
                Cost = charged,
            };
        })];
    }

    /// <summary>"Khách hàng" of a send that went to one customer: that customer's name.</summary>
    private async Task<Dictionary<Guid, string>> SoleCustomersAsync(IReadOnlyCollection<MessageSendBatch> sends)
    {
        var ids = sends.Where(b => b.RecipientCount + b.SkippedCount == 1).Select(b => b.Id).ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var rows = await AsyncExecuter.ToListAsync((await messages.GetQueryableAsync())
            .Where(m => m.SendBatchId != null && ids.Contains(m.SendBatchId.Value))
            .Select(m => new { BatchId = m.SendBatchId!.Value, m.RecipientName }));
        return rows.GroupBy(r => r.BatchId).ToDictionary(g => g.Key, g => g.First().RecipientName);
    }

    private static T Fill<T>(T dto, MessageSendBatch batch, MessageBatchCounts? counts, string? customerName)
        where T : MessageCampaignDto
    {
        var of = counts ?? MessageBatchCounts.None;
        dto.Id = batch.Id;
        dto.Channel = batch.Channel;
        dto.TemplateId = batch.TemplateId;
        dto.TemplateName = batch.TemplateName;
        dto.Source = batch.Source;
        dto.CareType = batch.CareType;
        dto.FromDate = batch.FromDate;
        dto.ToDate = batch.ToDate;
        dto.CustomerName = customerName;
        dto.SelectedCount = batch.RecipientCount + batch.SkippedCount;
        dto.RecipientCount = batch.RecipientCount;
        dto.SkippedCount = batch.SkippedCount;
        dto.SucceededCount = of.Sent;
        dto.FailedCount = of.Failed;
        dto.PendingCount = of.Pending;
        dto.StoppedCount = of.Stopped;
        dto.Status = batch.Status;
        dto.ScheduledAt = batch.ScheduledAt;
        dto.CreationTime = batch.CreationTime;
        dto.LastRunAt = batch.StartedAt ?? batch.ScheduledAt ?? batch.CreationTime;
        return dto;
    }

    private static MessageCampaignOutcome OutcomeOf(MessageSendStatus status) => status switch
    {
        MessageSendStatus.Sent or MessageSendStatus.Delivered => MessageCampaignOutcome.Succeeded,
        MessageSendStatus.Failed => MessageCampaignOutcome.Failed,
        MessageSendStatus.Skipped => MessageCampaignOutcome.Skipped,
        MessageSendStatus.Pending => MessageCampaignOutcome.Pending,
        _ => MessageCampaignOutcome.Stopped,
    };

    /// <summary>Why a customer was left out; none is a send made before F-79, which did not say.</summary>
    private string SkipLabel(MessageSkipReason? reason) =>
        L[reason is { } known ? $"CSKH:Campaign:Skip:{known}" : "CSKH:Campaign:Skip:Unrecorded"].Value;
}
