using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;
using Volo.Abp.Timing;

namespace BlueDental.Chat;

/// <summary>
/// Kho lưu trữ of one conversation (R-1160): the pictures, files and links
/// its members have sent. A recalled message takes its files and links out
/// of here as it does from the thread. The caller checks membership first.
/// </summary>
public class ChatSharedLibrary(
    IRepository<ChatMessage, Guid> messages,
    IRepository<ChatAttachment, Guid> attachments,
    IAsyncQueryableExecuter asyncExecuter,
    IChatCipher cipher,
    IClock clock) : ITransientDependency
{
    private const int BatchSize = 500;

    public async Task<SharedFilePage> FilesAsync(Guid conversationId, GetChatSharedFilesInput input)
    {
        var sent = await SentQueryAsync(conversationId, input);
        var files = (await attachments.GetQueryableAsync()).Where(a => a.ConversationId == conversationId);
        files = input.Kind == ChatSharedFileKind.Media
            ? files.Where(a => a.ContentType.StartsWith("image/"))
            : files.Where(a => !a.ContentType.StartsWith("image/"));

        var query =
            from a in files
            join m in sent on a.MessageId equals (Guid?)m.Id
            orderby m.SentAt descending, m.Id descending, a.CreationTime, a.Id
            select new { File = a, Message = m };

        var page = await asyncExecuter.ToListAsync(query.Skip(input.SkipCount).Take(input.MaxResultCount + 1));
        return new SharedFilePage(
            page.Take(input.MaxResultCount).Select(p => (p.File, p.Message)).ToList(),
            HasMore: page.Count > input.MaxResultCount);
    }

    /// <summary>
    /// Links live inside the sealed text, so the newest
    /// <see cref="ChatConsts.MaxSearchScan"/> messages are opened here in batches,
    /// the same bound the message search keeps.
    /// </summary>
    public async Task<SharedLinkResult> LinksAsync(Guid conversationId, ChatSharedFilterInput filter)
    {
        var startedAt = clock.Now;
        var found = new List<(ChatMessage Message, string Url)>();
        using (messages.DisableTracking())
        {
            var query = (await SentQueryAsync(conversationId, filter))
                .Where(m => m.SentAt <= startedAt && m.ContentCipher != null)
                .OrderByDescending(m => m.SentAt)
                .ThenByDescending(m => m.Id);

            for (var scanned = 0; scanned < ChatConsts.MaxSearchScan; scanned += BatchSize)
            {
                var batch = await asyncExecuter.ToListAsync(query.Skip(scanned).Take(BatchSize));
                foreach (var message in batch)
                {
                    foreach (var url in ChatLinks.Find(ChatPatientTokens.ToDisplay(message.ReadContent(cipher))))
                    {
                        found.Add((message, url));
                        if (found.Count > ChatConsts.MaxSharedLinks)
                        {
                            return new SharedLinkResult(found.Take(ChatConsts.MaxSharedLinks).ToList(), IsComplete: false);
                        }
                    }
                }

                if (batch.Count < BatchSize)
                {
                    return new SharedLinkResult(found, IsComplete: true);
                }
            }

            var olderLeft = await asyncExecuter.AnyAsync(query.Skip(ChatConsts.MaxSearchScan));
            return new SharedLinkResult(found, IsComplete: !olderLeft);
        }
    }

    private async Task<IQueryable<ChatMessage>> SentQueryAsync(Guid conversationId, ChatSharedFilterInput filter)
    {
        var query = (await messages.GetQueryableAsync())
            .Where(m => m.ConversationId == conversationId && m.RecalledAt == null);
        if (filter.SenderId is { } senderId)
        {
            query = query.Where(m => m.SenderId == senderId);
        }

        if (filter.SentFrom is { } from)
        {
            var start = ClinicCalendar.StartOfDay(from).UtcDateTime;
            query = query.Where(m => m.SentAt >= start);
        }

        if (filter.SentTo is { } to)
        {
            var end = ClinicCalendar.StartOfDay(to.AddDays(1)).UtcDateTime;
            query = query.Where(m => m.SentAt < end);
        }

        return query;
    }
}

public sealed record SharedFilePage(List<(ChatAttachment File, ChatMessage Message)> Items, bool HasMore);

/// <param name="Items">Newest message first; a message's links in the order written.</param>
public sealed record SharedLinkResult(List<(ChatMessage Message, string Url)> Items, bool IsComplete);
