using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations;

[RemoteService]
[Authorize]
[Route("api/v1/app/operations")]
public sealed class OperationController(
    IOperationAppService service) : BlueDentalController
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

}
