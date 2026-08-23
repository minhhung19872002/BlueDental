using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.FileManagement;

[Authorize]
public class FileAttachmentAppService : ApplicationService, IFileAttachmentAppService
{
    private readonly IRepository<FileAttachment, Guid> _repository;

    public FileAttachmentAppService(IRepository<FileAttachment, Guid> repository)
    {
        _repository = repository;
    }

    public async Task<PagedResultDto<FileAttachmentDto>> GetListAsync(GetFileAttachmentListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.OwnerEntityType))
            query = query.Where(f => f.OwnerEntityType == input.OwnerEntityType);

        if (input.OwnerEntityId.HasValue)
            query = query.Where(f => f.OwnerEntityId == input.OwnerEntityId.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(f => f.FileName.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<FileAttachmentDto>(
            totalCount,
            ObjectMapper.Map<List<FileAttachment>, List<FileAttachmentDto>>(items));
    }

    public async Task<FileAttachmentDto> GetAsync(Guid id)
    {
        var attachment = await _repository.GetAsync(id);
        return ObjectMapper.Map<FileAttachment, FileAttachmentDto>(attachment);
    }

    public async Task<FileAttachmentDto> CreateAsync(CreateFileAttachmentDto input)
    {
        var attachment = new FileAttachment(
            GuidGenerator.Create(),
            input.FileName,
            input.ContentType,
            input.FileSizeBytes,
            input.BlobName,
            input.OwnerEntityType,
            input.OwnerEntityId,
            CurrentUser.Id,
            input.Description);

        await _repository.InsertAsync(attachment, autoSave: true);
        return ObjectMapper.Map<FileAttachment, FileAttachmentDto>(attachment);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
