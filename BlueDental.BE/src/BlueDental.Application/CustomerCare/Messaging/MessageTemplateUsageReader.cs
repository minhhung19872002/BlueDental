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
/// 30-day rule. Only messages that left count, not failures nor pending ones.
/// </summary>
public class MessageTemplateUsageReader : ITransientDependency
{
    public static readonly MessageSendStatus[] Delivered = [MessageSendStatus.Sent, MessageSendStatus.Delivered];

    /// <summary>"Bỏ qua khách đã nhận mẫu này trong 30 ngày".</summary>
    public static readonly TimeSpan RecentWindow = TimeSpan.FromDays(30);

    private readonly IRepository<MessageLog, Guid> _logs;
    private readonly IAsyncQueryableExecuter _executer;

    public MessageTemplateUsageReader(IRepository<MessageLog, Guid> logs, IAsyncQueryableExecuter executer)
    {
        _logs = logs;
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

    /// <summary>When each of these customers last got the template, for those who got it since <paramref name="since"/>.</summary>
    public async Task<Dictionary<Guid, DateTime>> LoadRecipientsAsync(
        Guid branchId, Guid templateId, IReadOnlyCollection<Guid> patientIds, DateTime since)
    {
        if (patientIds.Count == 0)
        {
            return [];
        }

        var logs = await _logs.GetQueryableAsync();
        var rows = await _executer.ToListAsync(logs
            .Where(l => l.ClinicBranchId == branchId && l.TemplateId == templateId)
            .Where(l => l.PatientId != null && patientIds.Contains(l.PatientId.Value))
            .Where(l => Delivered.Contains(l.Status) && l.SentAt >= since)
            .GroupBy(l => l.PatientId!.Value)
            .Select(g => new { PatientId = g.Key, Last = g.Max(l => l.SentAt) }));
        return rows.Where(r => r.Last.HasValue).ToDictionary(r => r.PatientId, r => r.Last!.Value);
    }
}

public sealed record MessageTemplateUsage(int Count, DateTime? LastSentAt);
