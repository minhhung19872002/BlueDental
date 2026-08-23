using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Tools;

public interface IToolsAppService : IApplicationService
{
    // Call Assignment
    Task<PagedResultDto<CallAssignmentDto>> GetCallAssignmentListAsync(GetCallAssignmentListInput input);
    Task<CallAssignmentDto> CreateCallAssignmentAsync(CreateCallAssignmentDto input);
    Task<CallAssignmentDto> UpdateCallAssignmentStatusAsync(Guid id, UpdateCallAssignmentStatusDto input);
    Task DeleteCallAssignmentAsync(Guid id);

    // Call Log
    Task<PagedResultDto<CallLogDto>> GetCallLogListAsync(GetCallLogListInput input);
    Task<CallLogDto> CreateCallLogAsync(CreateCallLogDto input);
    Task DeleteCallLogAsync(Guid id);

    // Message Template
    Task<PagedResultDto<MessageTemplateDto>> GetMessageTemplateListAsync(GetMessageTemplateListInput input);
    Task<MessageTemplateDto> CreateMessageTemplateAsync(CreateMessageTemplateDto input);
    Task<MessageTemplateDto> UpdateMessageTemplateAsync(Guid id, UpdateMessageTemplateDto input);
    Task DeleteMessageTemplateAsync(Guid id);

    // Message Log
    Task<PagedResultDto<MessageLogDto>> GetMessageLogListAsync(GetMessageLogListInput input);
}
