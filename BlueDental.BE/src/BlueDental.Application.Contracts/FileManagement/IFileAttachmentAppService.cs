using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.FileManagement;

public interface IFileAttachmentAppService : IApplicationService
{
    Task<PagedResultDto<FileAttachmentDto>> GetListAsync(GetFileAttachmentListInput input);
    Task<FileAttachmentDto> GetAsync(Guid id);
    Task<FileAttachmentDto> CreateAsync(CreateFileAttachmentDto input);
    Task DeleteAsync(Guid id);
}
