using System;
using System.Threading.Tasks;
using BlueDental.Zalo;
using Volo.Abp.DependencyInjection;

namespace BlueDental.ZaloInbox;

/// <summary>
/// BA P2210 "Lấy danh sách tin nhắn của khách hàng ở Zalo OA": what Zalo
/// holds is read into the inbox — the recent chats for conversations the
/// webhook missed, and one conversation's history 10 messages at a time
/// (Zalo's page). Messages already stored are skipped by their Zalo id.
/// </summary>
public class ZaloInboxSync(ZaloOaGateway gateway, IZaloApiClient zalo, ZaloInboxIngestor ingestor) : ITransientDependency
{
    /// <summary>Five pages of Zalo's recent chats: the 50 latest conversations.</summary>
    public const int RecentPages = 5;

    public async Task<ZaloChatSyncResultDto> SyncRecentAsync(ZaloOaConnection connection)
    {
        var result = new ZaloChatSyncResultDto();
        for (var page = 0; page < RecentPages; page++)
        {
            var offset = page * HttpZaloApiClient.MaxChatPage;
            var outcome = await gateway.CallWithTokenAsync(connection,
                token => zalo.GetRecentChatsAsync(token, offset, HttpZaloApiClient.MaxChatPage),
                o => o.Call);
            await gateway.LogAsync(connection.ClinicBranchId, "chat-recent", outcome.Call, outcome.Items.Count);
            if (!outcome.Call.Succeeded)
            {
                result.Error = outcome.Call.Error;
                return result;
            }

            foreach (var item in outcome.Items)
            {
                if (item.UserId is not { } userId || userId == connection.OaId)
                {
                    continue;
                }

                var conversation = await ingestor.EnsureConversationAsync(
                    connection, userId, item.UserDisplayName, item.UserAvatar);
                if (await ingestor.RecordAsync(conversation, ToChat(userId, item)))
                {
                    result.Added++;
                }
            }

            result.HasMore = outcome.Items.Count == HttpZaloApiClient.MaxChatPage;
            if (!result.HasMore)
            {
                break;
            }
        }

        return result;
    }

    public async Task<ZaloChatSyncResultDto> SyncConversationAsync(
        ZaloOaConnection connection, ZaloConversation conversation, int offset)
    {
        var outcome = await gateway.CallWithTokenAsync(connection,
            token => zalo.GetConversationAsync(token, conversation.ZaloUserId, offset, HttpZaloApiClient.MaxChatPage),
            o => o.Call);
        await gateway.LogAsync(connection.ClinicBranchId, "chat-history", outcome.Call, outcome.Items.Count);
        if (!outcome.Call.Succeeded)
        {
            return new ZaloChatSyncResultDto { Error = outcome.Call.Error };
        }

        var result = new ZaloChatSyncResultDto { HasMore = outcome.Items.Count == HttpZaloApiClient.MaxChatPage };
        foreach (var item in outcome.Items)
        {
            if (await ingestor.RecordAsync(conversation, ToChat(conversation.ZaloUserId, item)))
            {
                result.Added++;
            }
        }

        return result;
    }

    /// <summary>
    /// Whatever text Zalo gives is kept, whatever the type: an OA's list or
    /// template message, a photo's caption. Dropping it left only "[Tin nhắn
    /// khác]" on screen for messages that did carry words.
    /// </summary>
    private static ZaloIncomingChat ToChat(string userId, ZaloChatItem item) =>
        new(
            userId,
            item.MessageId,
            item.FromOa ? ZaloChatDirection.Outbound : ZaloChatDirection.Inbound,
            ZaloChatKinds.OfHistoryType(item.Type),
            item.Text,
            item.Url,
            item.TimeMs > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(item.TimeMs).UtcDateTime : DateTime.UtcNow);
}
