using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Chiến dịch đã gửi (BA P2210, F-79): the branch's sends of Gửi tin
/// nhắn, what each did to each customer, and "Tạm dừng" for one still going.
/// </summary>
public interface IMessageCampaignAppService : IApplicationService
{
    /// <summary>The sends, newest first.</summary>
    Task<PagedResultDto<MessageCampaignDto>> GetListAsync(MessageCampaignPagedInput input);

    /// <summary>"Kết quả lần gửi": the header, the cards and the reasons.</summary>
    Task<MessageCampaignDetailDto> GetAsync(Guid id);

    /// <summary>The table of "Kết quả lần gửi", one tab at a time.</summary>
    Task<PagedResultDto<MessageCampaignRecipientDto>> GetRecipientsAsync(Guid id, GetMessageCampaignRecipientsInput input);

    /// <summary>
    /// "Tạm dừng": what went stays sent, the messages still waiting never go;
    /// a send not started yet is called off. There is no going on afterwards.
    /// </summary>
    Task<MessageCampaignDto> StopAsync(Guid id);

    /// <summary>"Xuất Excel danh sách lỗi": the customers it failed and those it left out.</summary>
    Task<byte[]> ExportFailuresAsync(Guid id);
}
