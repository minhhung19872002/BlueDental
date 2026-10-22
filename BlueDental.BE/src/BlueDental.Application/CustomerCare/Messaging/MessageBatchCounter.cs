using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Tools;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>Where each send's messages stand: gone, refused, still waiting.</summary>
public sealed record MessageBatchCounts(int Sent, int Failed, int Pending)
{
    public static readonly MessageBatchCounts None = new(0, 0, 0);
}

/// <summary>
/// Counts a page of sends in one query — "Gần đây" of Gửi tin nhắn (F-77) and
/// "Lịch sử gửi" of Thống kê CSKH (F-78) read them the same way.
/// </summary>
public class MessageBatchCounter(IRepository<MessageLog, Guid> messages, IAsyncQueryableExecuter executer)
    : ITransientDependency
{
    public async Task<Dictionary<Guid, MessageBatchCounts>> CountAsync(IReadOnlyCollection<Guid> batchIds)
    {
        if (batchIds.Count == 0)
        {
            return [];
        }

        var rows = await executer.ToListAsync((await messages.GetQueryableAsync())
            .Where(m => m.SendBatchId != null && batchIds.Contains(m.SendBatchId.Value))
            .GroupBy(m => new { BatchId = m.SendBatchId!.Value, m.Status })
            .Select(g => new { g.Key.BatchId, g.Key.Status, Count = g.Count() }));
        return rows.GroupBy(r => r.BatchId).ToDictionary(
            g => g.Key,
            g => new MessageBatchCounts(
                g.Where(r => MessageTemplateUsageReader.Delivered.Contains(r.Status)).Sum(r => r.Count),
                g.Where(r => r.Status == MessageSendStatus.Failed).Sum(r => r.Count),
                g.Where(r => r.Status == MessageSendStatus.Pending).Sum(r => r.Count)));
    }
}
