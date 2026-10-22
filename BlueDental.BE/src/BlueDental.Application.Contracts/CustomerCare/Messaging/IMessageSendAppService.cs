using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Gửi tin nhắn (BA P2110, F-77): one template over one channel to a
/// CSKH list or to customers picked one by one, now or at a set time. Only
/// Zalo goes out for real; SMS and e-mail have no provider yet.
/// </summary>
public interface IMessageSendAppService : IApplicationService
{
    Task<MessageSendTemplatesDto> GetTemplatesAsync();

    /// <summary>The 10 CSKH tabs with how many customers each holds over the period.</summary>
    Task<List<MessageSendListDto>> GetListsAsync(GetMessageSendListsInput input);

    /// <summary>Every customer the send would cover, each with why they would be left out.</summary>
    Task<MessageRecipientListDto> GetRecipientsAsync(MessageRecipientsInput input);

    Task<MessagePreviewDto> PreviewAsync(PreviewMessageSendInput input);

    /// <summary>"Khách lẻ": the branch's customers matching the search.</summary>
    Task<List<MessageSendCustomerDto>> FindCustomersAsync(FindMessageSendCustomersInput input);

    /// <summary>"Gửi" / "Hẹn gửi": books the messages and hands them to the background sender.</summary>
    Task<MessageSendBatchDto> CreateAsync(CreateMessageSendInput input);

    Task<MessageSendBatchDto> GetAsync(Guid id);

    Task<List<MessageSendBatchDto>> GetListAsync(GetMessageSendBatchListInput input);

    /// <summary>"Huỷ hẹn gửi": only while the batch still waits for its time.</summary>
    Task<MessageSendBatchDto> CancelAsync(Guid id);

    /// <summary>"Gửi thử tới tôi": the message once, to the signed-in staff member's own phone.</summary>
    Task<MessageTestSendDto> SendTestAsync(SendTestMessageInput input);
}
