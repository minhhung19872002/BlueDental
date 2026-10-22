using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Zalo;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Template tin nhắn (BA P2110, F-76): the current branch's message
/// templates, their editor's variable library and preview, and the ZNS
/// templates a Zalo template links to.
/// </summary>
public interface IMessageTemplateAppService : IApplicationService
{
    Task<MessageTemplateListDto> GetListAsync(GetMessageTemplateListInput input);

    Task<MessageTemplateDto> GetAsync(Guid id);

    Task<MessageTemplateDto> CreateAsync(CreateMessageTemplateInput input);

    /// <summary>The channel stays as created.</summary>
    Task<MessageTemplateDto> UpdateAsync(Guid id, SaveMessageTemplateInput input);

    /// <summary>"Nhân bản": a draft copy named "… - bản sao".</summary>
    Task<MessageTemplateDto> DuplicateAsync(Guid id);

    Task<List<MessageVariableDto>> GetVariablesAsync();

    /// <summary>A random customer of the branch, preferring one with a visit ahead; never <paramref name="exceptPatientId"/>.</summary>
    Task<MessageSampleCustomerDto> GetSampleCustomerAsync(Guid? exceptPatientId);

    Task<MessagePreviewDto> PreviewAsync(PreviewMessageTemplateInput input);

    /// <summary>The OA's ZNS templates, every status.</summary>
    Task<List<ZaloTemplateDto>> GetZnsTemplatesAsync();

    Task<ZaloTemplateDetailDto> GetZnsTemplateAsync(string templateId);

    /// <summary>Reads Zalo's review status of every linked ZNS template into the list.</summary>
    Task<SyncZaloTemplateStatusDto> SyncZaloStatusAsync();
}
