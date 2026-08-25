using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;
using BlueDental.Staff;

namespace BlueDental.BranchManager;

[RemoteService]
[Authorize]
[Route("api/v1/app/branch-managers")]
public sealed class BranchManagerController(IBranchManagerAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<BranchManagerDto>> GetListAsync([FromQuery] GetBranchManagerListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<BranchManagerDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<BranchManagerDto> CreateAsync([FromBody] CreateBranchManagerDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<BranchManagerDto> UpdateAsync(Guid id, [FromBody] UpdateBranchManagerDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPost("{id:guid}/avatar")]
    public Task<AvatarResultDto> UploadAvatarAsync(Guid id, [FromForm] IFormFile file) =>
        service.UploadAvatarAsync(id, new RemoteStreamContent(
            file.OpenReadStream(), file.FileName, file.ContentType, file.Length));

    [HttpDelete("{id:guid}/avatar")]
    public Task DeleteAvatarAsync(Guid id) => service.DeleteAvatarAsync(id);

    [HttpGet("{id:guid}/avatar")]
    public async Task<IActionResult> GetAvatarAsync(Guid id)
    {
        var stream = await service.GetAvatarContentAsync(id);
        return File(stream, "image/jpeg");
    }
}
