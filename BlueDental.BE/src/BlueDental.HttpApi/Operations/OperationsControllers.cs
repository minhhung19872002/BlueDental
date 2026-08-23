using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations;

/// <summary>Trang chủ / Quy trình của từng khối.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/operations-articles")]
public sealed class OperationsArticleController(IOperationsArticleAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<OperationsArticleDto>> GetListAsync(
        [FromQuery] GetOperationsArticleListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<OperationsArticleDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<OperationsArticleDto> CreateAsync([FromBody] CreateOperationsArticleDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<OperationsArticleDto> UpdateAsync(
        Guid id, [FromBody] UpdateOperationsArticleDto input) => service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/publish")]
    public Task<OperationsArticleDto> PublishAsync(Guid id) => service.PublishAsync(id);

    [HttpPost("{id:guid}/unpublish")]
    public Task<OperationsArticleDto> UnpublishAsync(Guid id) => service.UnpublishAsync(id);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Công việc của từng khối.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/operations-tasks")]
public sealed class OperationsTaskController(IOperationsTaskAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<OperationsTaskDto>> GetListAsync(
        [FromQuery] GetOperationsTaskListInput input) => service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<OperationsTaskStatsDto> GetStatsAsync(
        [FromQuery] GetOperationsTaskListInput input) => service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<OperationsTaskDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<OperationsTaskDto> CreateAsync([FromBody] CreateOperationsTaskDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<OperationsTaskDto> UpdateAsync(Guid id, [FromBody] UpdateOperationsTaskDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/start")]
    public Task<OperationsTaskDto> StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task<OperationsTaskDto> CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<OperationsTaskDto> CancelAsync(Guid id, [FromBody] CancelOperationsTaskDto input) =>
        service.CancelAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
