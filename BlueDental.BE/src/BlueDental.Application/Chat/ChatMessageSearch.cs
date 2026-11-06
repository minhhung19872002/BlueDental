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
/// Finds messages of one thread by their text (R-1158). The text is sealed in
/// the database, so there is nothing to index or LIKE: the newest
/// <see cref="ChatConsts.MaxSearchScan"/> messages are opened here, in batches,
/// and matched the way every other search box matches — all the words, any
/// order, accents and case ignored. No hash or index of the words is stored,
/// so a copy of the database tells nothing about what was written.
/// </summary>
public class ChatMessageSearch(
    IRepository<ChatMessage, Guid> messages,
    IAsyncQueryableExecuter asyncExecuter,
    IChatCipher cipher,
    IClock clock) : ITransientDependency
{
    private const int BatchSize = 500;

    public async Task<ChatMessageSearchResult> FindAsync(Guid conversationId, string text)
    {
        var terms = SearchTerms.From(text).Select(SearchTerms.Fold).Where(t => t.Length > 0).ToList();
        if (terms.Count == 0)
        {
            return new ChatMessageSearchResult([], IsComplete: true);
        }

        // Messages sent while the scan runs are left out, so the offsets below
        // keep pointing at the same rows.
        var startedAt = clock.Now;
        var found = new List<ChatMessage>();
        using (messages.DisableTracking())
        {
            var query = (await messages.GetQueryableAsync())
                .Where(m => m.ConversationId == conversationId && m.RecalledAt == null && m.SentAt <= startedAt)
                .OrderByDescending(m => m.SentAt)
                .ThenByDescending(m => m.Id);

            for (var scanned = 0; scanned < ChatConsts.MaxSearchScan; scanned += BatchSize)
            {
                var batch = await asyncExecuter.ToListAsync(query.Skip(scanned).Take(BatchSize));
                foreach (var message in batch)
                {
                    var content = SearchTerms.Fold(message.ReadContent(cipher));
                    if (content.Length > 0 && terms.All(content.Contains))
                    {
                        found.Add(message);
                        if (found.Count > ChatConsts.MaxSearchResults)
                        {
                            return new ChatMessageSearchResult(found.Take(ChatConsts.MaxSearchResults).ToList(), IsComplete: false);
                        }
                    }
                }

                if (batch.Count < BatchSize)
                {
                    return new ChatMessageSearchResult(found, IsComplete: true);
                }
            }

            var olderLeft = await asyncExecuter.AnyAsync(query.Skip(ChatConsts.MaxSearchScan));
            return new ChatMessageSearchResult(found, IsComplete: !olderLeft);
        }
    }
}

/// <param name="Found">Newest first.</param>
/// <param name="IsComplete">False when older messages were not looked at or more matched.</param>
public sealed record ChatMessageSearchResult(List<ChatMessage> Found, bool IsComplete);
