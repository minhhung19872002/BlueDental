using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Microsoft.AspNetCore.Http;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.Operations;

[RemoteService]
[Authorize]
[Route("api/v1/app/operations")]
public sealed class OperationController(
    IOperationAppService service,
    IOperationArticleImageAppService images) : BlueDentalController
{
    [HttpGet("categories")]
    public Task<PagedResultDto<OperationCategoryDto>> GetCategoryListAsync(
        [FromQuery] GetOperationListInput input) => service.GetCategoryListAsync(input);

    [HttpPost("categories")]
    public Task<OperationCategoryDto> CreateCategoryAsync(CreateOperationCategoryDto input) =>
        service.CreateCategoryAsync(input);

    [HttpPut("categories/{id}")]
    public Task<OperationCategoryDto> UpdateCategoryAsync(
        Guid id,
        UpdateOperationCategoryDto input) => service.UpdateCategoryAsync(id, input);

    [HttpDelete("categories/{id}")]
    public Task DeleteCategoryAsync(Guid id) => service.DeleteCategoryAsync(id);

    [HttpGet("articles")]
    public Task<PagedResultDto<OperationArticleDto>> GetArticleListAsync(
        [FromQuery] GetOperationListInput input) => service.GetArticleListAsync(input);

    [HttpPost("articles")]
    public Task<OperationArticleDto> CreateArticleAsync(CreateOperationArticleDto input) =>
        service.CreateArticleAsync(input);

    [HttpPut("articles/{id}")]
    public Task<OperationArticleDto> UpdateArticleAsync(Guid id, UpdateOperationArticleDto input) =>
        service.UpdateArticleAsync(id, input);

    [HttpDelete("articles/{id}")]
    public Task DeleteArticleAsync(Guid id) => service.DeleteArticleAsync(id);

    /// <summary>
    /// An image dropped into an article's body. Multipart, so the DTO is bound
    /// by hand rather than from the JSON body — the same shape the QR upload
    /// uses.
    /// </summary>
    [HttpPost("article-images")]
    public Task<OperationArticleImageDto> UploadArticleImageAsync(
        [FromForm] IFormFile file,
        [FromForm] Guid clinicBranchId) =>
        images.UploadAsync(new UploadOperationArticleImageDto
        {
            ClinicBranchId = clinicBranchId,
            File = new RemoteStreamContent(
                file.OpenReadStream(),
                file.FileName,
                file.ContentType,
                file.Length),
        });

    [HttpGet("article-images/{id:guid}")]
    public async Task<IActionResult> GetArticleImageAsync(Guid id)
    {
        var content = await images.GetAsync(id);

        return File(content.GetStream(), content.ContentType ?? "application/octet-stream");
    }
}
