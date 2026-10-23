using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.ZaloInbox;

/// <summary>CSKH ▸ Hộp thư Zalo (BA P2210, F-80): the conversations of the current branch's OA.</summary>
public interface IZaloInboxAppService : IApplicationService
{
    Task<ZaloInboxListDto> GetListAsync(GetZaloConversationsInput input);

    /// <summary>The chip counts alone — the "Hộp thư Zalo 4" badge on the CSKH tab row.</summary>
    Task<ZaloInboxCountsDto> GetCountsAsync();

    Task<ZaloConversationDetailDto> GetAsync(Guid id);

    /// <summary>The chat, oldest first, with the ZNS the linked record got woven in.</summary>
    Task<List<ZaloChatEntryDto>> GetMessagesAsync(Guid id);

    /// <summary>Zalo's recent chats into the inbox — conversations the webhook missed.</summary>
    Task<ZaloChatSyncResultDto> SyncRecentAsync();

    /// <summary>One conversation's history from Zalo, 10 messages from <c>offset</c>.</summary>
    Task<ZaloChatSyncResultDto> SyncConversationAsync(Guid id, SyncZaloConversationInput input);

    Task<ZaloConversationDetailDto> ClaimAsync(Guid id);

    Task<ZaloConversationDetailDto> ReleaseAsync(Guid id);

    Task<ZaloConversationDetailDto> TransferAsync(Guid id, TransferZaloConversationInput input);

    /// <summary>Staff of the branch who hold Hộp thư Zalo › Xử lý, the caller left out.</summary>
    Task<List<ZaloInboxAssigneeDto>> GetAssigneesAsync();

    Task<ZaloChatEntryDto> SendMessageAsync(Guid id, SendZaloChatMessageInput input);

    Task<List<string>> SetTagsAsync(Guid id, SetZaloConversationTagsInput input);

    /// <summary>Tags already used in the branch's inbox, for the "+ Tag" box to suggest.</summary>
    Task<List<string>> GetTagSuggestionsAsync();

    Task<ZaloConversationDetailDto> LinkPatientAsync(Guid id, LinkZaloConversationPatientInput input);

    Task<List<ZaloInboxPatientDto>> FindPatientsAsync(FindZaloInboxPatientsInput input);
}

/// <summary>The ZNS templates above the Hộp thư Zalo composer: pick, check with the customer's data, send.</summary>
public interface IZaloInboxZnsAppService : IApplicationService
{
    /// <summary>The branch's Zalo templates ready to send, newest first.</summary>
    Task<List<ZaloInboxTemplateDto>> GetTemplatesAsync();

    Task<ZaloZnsPreviewDto> PreviewAsync(Guid conversationId, ZaloZnsInput input);

    /// <summary>Sends to the linked record's phone; the ZNS then shows in the chat.</summary>
    Task<ZaloChatEntryDto> SendAsync(Guid conversationId, ZaloZnsInput input);
}
