using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.BackgroundJobs;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.CustomerCare.Messaging;

[BackgroundJobName("cskh.message-send")]
public class MessageSendJobArgs
{
    public Guid BatchId { get; set; }
}

/// <summary>
/// Sends the Pending messages of one <see cref="MessageSendBatch"/> (F-77).
///
/// Each message is filled from the customer's data as it is now and saved
/// on its own, so a host stopped half-way leaves the sent ones sent and the
/// job, run again, goes on with the rest. Nothing about the customer is
/// written to the application log — only ids.
/// </summary>
public class MessageSendJob : AsyncBackgroundJob<MessageSendJobArgs>, ITransientDependency
{
    private readonly IRepository<MessageSendBatch, Guid> _batches;
    private readonly IRepository<MessageLog, Guid> _messages;
    private readonly IRepository<MessageTemplate, Guid> _templates;
    private readonly IRepository<CareRecord, Guid> _careRecords;
    private readonly ZaloOaGateway _zalo;
    private readonly IZaloApiClient _zaloApi;
    private readonly MessageRecipientBuilder _recipients;
    private readonly IBackgroundJobManager _jobs;
    private readonly IUnitOfWorkManager _unitOfWork;
    private readonly IClock _clock;

    public MessageSendJob(
        IRepository<MessageSendBatch, Guid> batches,
        IRepository<MessageLog, Guid> messages,
        IRepository<MessageTemplate, Guid> templates,
        IRepository<CareRecord, Guid> careRecords,
        ZaloOaGateway zalo,
        IZaloApiClient zaloApi,
        MessageRecipientBuilder recipients,
        IBackgroundJobManager jobs,
        IUnitOfWorkManager unitOfWork,
        IClock clock)
    {
        _batches = batches;
        _messages = messages;
        _templates = templates;
        _careRecords = careRecords;
        _zalo = zalo;
        _zaloApi = zaloApi;
        _recipients = recipients;
        _jobs = jobs;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public override async Task ExecuteAsync(MessageSendJobArgs args)
    {
        var batch = await StartAsync(args.BatchId);
        if (batch == null)
        {
            return;
        }

        var plan = await PrepareAsync(batch);
        if (plan.Refusal != null)
        {
            await FailAllAsync(batch.Id, plan.Refusal);
        }
        else
        {
            foreach (var messageId in plan.MessageIds)
            {
                await SendOneAsync(batch.ClinicBranchId, messageId, plan);
            }
        }

        await CompleteAsync(batch.Id);
    }

    /// <summary>
    /// Takes the batch, or leaves it: called off, finished, or picked up
    /// early (its job is then queued again for the time it was set to).
    /// </summary>
    private async Task<MessageSendBatch?> StartAsync(Guid batchId)
    {
        using var uow = _unitOfWork.Begin(requiresNew: true);
        var batch = await _batches.FindAsync(batchId);
        if (batch == null)
        {
            return null;
        }

        var now = _clock.Now;
        if (!batch.TryStart(now))
        {
            if (batch is { Status: MessageSendBatchStatus.Queued, ScheduledAt: { } at })
            {
                await _jobs.EnqueueAsync(new MessageSendJobArgs { BatchId = batchId }, delay: at - now);
            }

            await uow.CompleteAsync();
            return null;
        }

        await _batches.UpdateAsync(batch);
        await uow.CompleteAsync();
        return batch;
    }

    /// <summary>The template, its ZNS parameters and every customer's data, read once for the whole batch.</summary>
    private async Task<SendPlan> PrepareAsync(MessageSendBatch batch)
    {
        using var uow = _unitOfWork.Begin(requiresNew: true);
        var messages = await _messages.GetListAsync(m =>
            m.SendBatchId == batch.Id && m.Status == MessageSendStatus.Pending);
        var template = await _templates.FindAsync(batch.TemplateId);
        var connection = await _zalo.FindConnectionAsync(batch.ClinicBranchId);

        SendPlan Refuse(string reason) => new([.. messages.Select(m => m.Id)], null, null, null, reason);

        if (template is not { CanSend: true, Channel: MessageChannelType.Zalo })
        {
            return Refuse("The template is no longer ready to send.");
        }

        if (connection is not { CanSend: true })
        {
            return Refuse("Zalo OA is not connected.");
        }

        ZaloTemplateDetail detail;
        try
        {
            detail = await _zalo.FetchTemplateDetailAsync(batch.ClinicBranchId, connection, template.ExternalTemplateId!);
        }
        catch (BusinessException ex) when (ex.Code == BlueDentalDomainErrorCodes.Tools.ZaloRequestFailed)
        {
            await uow.CompleteAsync();
            return Refuse($"Zalo template could not be read: {ex.Data["message"]}");
        }

        var values = await _recipients.ResolveForLogsAsync(batch.ClinicBranchId, messages);
        await uow.CompleteAsync();
        return new SendPlan([.. messages.Select(m => m.Id)], template, detail, values, null);
    }

    private async Task SendOneAsync(Guid branchId, Guid messageId, SendPlan plan)
    {
        Guid? careRecordId = null;
        try
        {
            using var uow = _unitOfWork.Begin(requiresNew: true);
            var message = await _messages.FindAsync(messageId);
            if (message is not { Status: MessageSendStatus.Pending })
            {
                return;
            }

            await SendAsync(branchId, message, plan);
            await _messages.UpdateAsync(message);
            await uow.CompleteAsync();
            careRecordId = message.Status == MessageSendStatus.Sent ? message.CareRecordId : null;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "CSKH message {MessageId} could not be sent.", messageId);
            await FailAsync(messageId, "Send error.");
            return;
        }

        if (careRecordId is { } recordId)
        {
            await MarkCareRecordAsync(recordId);
        }
    }

    private async Task SendAsync(Guid branchId, MessageLog message, SendPlan plan)
    {
        if (!plan.Values!.TryGetValue(message.Id, out var values))
        {
            message.MarkFailed("Customer not found.");
            return;
        }

        var template = plan.Template!;
        var check = MessageRecipientBuilder.Check(template, plan.Detail!.Params, values);
        if (check.Missing.Count > 0)
        {
            message.MarkFailed($"Missing data: {string.Join(", ", check.Missing)}");
            return;
        }

        message.Fill(check.Message.Text).SetExternalTemplate(template.ExternalTemplateId, template.Name);
        var connection = (await _zalo.FindConnectionAsync(branchId))!;
        var outcome = await _zalo.CallWithTokenAsync(connection,
            token => _zaloApi.SendTemplateMessageAsync(
                token, message.RecipientPhone, plan.Detail.TemplateId, check.ZnsValues!, message.Id.ToString("N")),
            o => o.Call);
        if (outcome.Call.Succeeded)
        {
            message.MarkSent(outcome.MessageId, _clock.Now, plan.Detail.Price);
        }
        else
        {
            message.MarkFailed(outcome.Call.Error);
        }

        await _zalo.LogAsync(branchId, "zns-send", outcome.Call, outcome.Call.Succeeded ? 1 : 0);
    }

    /// <summary>The CSKH row shows "đã gửi Zalo" as the row buttons do; a row being edited just then keeps its own save.</summary>
    private async Task MarkCareRecordAsync(Guid recordId)
    {
        try
        {
            using var uow = _unitOfWork.Begin(requiresNew: true);
            var record = await _careRecords.FindAsync(recordId);
            if (record != null)
            {
                await _careRecords.UpdateAsync(record.MarkZaloSent());
            }

            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "CSKH record {CareRecordId} was not marked as sent by Zalo.", recordId);
        }
    }

    private async Task FailAsync(Guid messageId, string reason)
    {
        using var uow = _unitOfWork.Begin(requiresNew: true);
        var message = await _messages.FindAsync(messageId);
        if (message is { Status: MessageSendStatus.Pending })
        {
            await _messages.UpdateAsync(message.MarkFailed(reason));
        }

        await uow.CompleteAsync();
    }

    private async Task FailAllAsync(Guid batchId, string reason)
    {
        using var uow = _unitOfWork.Begin(requiresNew: true);
        var pending = await _messages.GetListAsync(m =>
            m.SendBatchId == batchId && m.Status == MessageSendStatus.Pending);
        foreach (var message in pending)
        {
            message.MarkFailed(reason);
        }

        await _messages.UpdateManyAsync(pending);
        await uow.CompleteAsync();
    }

    private async Task CompleteAsync(Guid batchId)
    {
        using var uow = _unitOfWork.Begin(requiresNew: true);
        var batch = await _batches.GetAsync(batchId);
        batch.Complete(_clock.Now);
        await _batches.UpdateAsync(batch);
        await uow.CompleteAsync();
    }

    private sealed record SendPlan(
        IReadOnlyList<Guid> MessageIds,
        MessageTemplate? Template,
        ZaloTemplateDetail? Detail,
        IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, string?>>? Values,
        string? Refusal);
}
