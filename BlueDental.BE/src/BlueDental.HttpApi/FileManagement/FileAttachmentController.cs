using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.FileManagement;

/// <summary>
/// The attachment records that point at files already stored in MinIO.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/file-attachments")]
public sealed class FileAttachmentController(IFileAttachmentAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<FileAttachmentDto>> GetListAsync([FromQuery] GetFileAttachmentListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<FileAttachmentDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<FileAttachmentDto> CreateAsync([FromBody] CreateFileAttachmentDto input) => service.CreateAsync(input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
