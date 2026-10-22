using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Tools;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// What a template has already sent: "ĐÃ GỬI" / "Dùng lần cuối" on the
/// template list and the Gửi tin nhắn picker, and who got it lately for the
/// 30-day rule. The counts take only messages that left; the 30-day rule
/// also takes those still waiting to go.
/// </summary>
public class MessageTemplateUsageReader : ITransientDependency
{
    public static readonly MessageSendStatus[] Delivered = [MessageSendStatus.Sent, MessageSendStatus.Delivered];

    /// <summary>"Bỏ qua khách đã nhận mẫu này trong 30 ngày".</summary>
    public static readonly TimeSpan RecentWindow = TimeSpan.FromDays(30);

    private readonly IRepository<MessageLog, Guid> _logs;
    private readonly IRepository<MessageSendBatch, Guid> _batches;
    private readonly IAsyncQueryableExecuter _executer;

    public MessageTemplateUsageReader(
        IRepository<MessageLog, Guid> logs, IRepository<MessageSendBatch, Guid> batches, IAsyncQueryableExecuter executer)
    {
        _logs = logs;
        _batches = batches;
        _executer = executer;
    }

    public async Task<Dictionary<Guid, MessageTemplateUsage>> LoadAsync(Guid branchId, IReadOnlyCollection<Guid> templateIds)
    {
        if (templateIds.Count == 0)
        {
            return [];
        }

        var logs = await _logs.GetQueryableAsync();
        var rows = await _executer.ToListAsync(logs
            .Where(l => l.ClinicBranchId == branchId && l.TemplateId != null && templateIds.Contains(l.TemplateId.Value))
            .Where(l => Delivered.Contains(l.Status))
            .GroupBy(l => l.TemplateId!.Value)
            .Select(g => new { TemplateId = g.Key, Count = g.Count(), Last = g.Max(l => l.SentAt) }));
        return rows.ToDictionary(r => r.TemplateId, r => new MessageTemplateUsage(r.Count, r.Last));
    }

    /// <summary>
    /// When each of these customers last got the template, for those who got
    /// it since <paramref name="since"/> — or when they will: a message still
    /// waiting in a batch counts whatever its date, dated when it is due, so a
    /// list sent now is not sent again by a "Hẹn giờ gửi" of it (R-1013).
    /// "Huỷ hẹn" deletes the waiting messages, so each belongs to a live batch.
    /// </summary>
    public async Task<Dictionary<Guid, MessageReceipt>> LoadRecipientsAsync(
        Guid branchId, Guid templateId, IReadOnlyCollection<Guid> patientIds, DateTime since)
    {
        if (patientIds.Count == 0)
        {
            return [];
        }

        var logs = (await _logs.GetQueryableAsync())
            .Where(l => l.ClinicBranchId == branchId && l.TemplateId == templateId)
            .Where(l => l.PatientId != null && patientIds.Contains(l.PatientId.Value));
        var sent = await _executer.ToListAsync(logs
            .Where(l => Delivered.Contains(l.Status) && l.SentAt >= since)
            .GroupBy(l => l.PatientId!.Value)
            .Select(g => new { PatientId = g.Key, Last = g.Max(l => l.SentAt) }));
        var waiting = await _executer.ToListAsync(logs
            .Where(l => l.Status == MessageSendStatus.Pending)
            .Select(l => new { PatientId = l.PatientId!.Value, l.SendBatchId, l.CreationTime }));

        var receipts = sent
            .Where(r => r.Last.HasValue)
            .ToDictionary(r => r.PatientId, r => new MessageReceipt(r.Last!.Value, Pending: false));
        if (waiting.Count == 0)
        {
            return receipts;
        }

        var batchIds = waiting.Where(w => w.SendBatchId.HasValue).Select(w => w.SendBatchId!.Value).Distinct().ToList();
        var due = (await _executer.ToListAsync((await _batches.GetQueryableAsync())
                .Where(b => batchIds.Contains(b.Id))
                .Select(b => new { b.Id, b.ScheduledAt })))
            .ToDictionary(b => b.Id, b => b.ScheduledAt);
        foreach (var customer in waiting.GroupBy(w => w.PatientId))
        {
            var next = customer.Min(w => (w.SendBatchId is { } id ? due.GetValueOrDefault(id) : null) ?? w.CreationTime);
            receipts[customer.Key] = new MessageReceipt(next, Pending: true);
        }

        return receipts;
    }
}

public sealed record MessageTemplateUsage(int Count, DateTime? LastSentAt);

/// <summary>When a customer got a template, or — <see cref="Pending"/> — is booked to get it.</summary>
public sealed record MessageReceipt(DateTime At, bool Pending);
