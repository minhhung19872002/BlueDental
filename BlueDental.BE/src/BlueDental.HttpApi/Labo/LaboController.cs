using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.Labo;

[RemoteService]
[Authorize]
[Route("api/v1/app/labo-orders")]
public sealed class LaboController(ILaboAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<LaboOrderDto>> GetListAsync([FromQuery] GetLaboOrderListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<LaboStatsDto> GetStatsAsync([FromQuery] GetLaboOrderListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<LaboOrderDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("next-code")]
    public Task<string> GetNextOrderCodeAsync() => service.GetNextOrderCodeAsync();

    /// <summary>JSON create, without pictures.</summary>
    [HttpPost]
    [Consumes("application/json")]
    public Task<LaboOrderDto> CreateAsync([FromBody] CreateLaboOrderDto input) => service.CreateAsync(input);

    /// <summary>
    /// The dialog's Lưu: the same fields as form values plus the Tải ảnh files
    /// under <c>pictures</c>, so the order and its pictures land in one request.
    /// Routed by content type; the file parts are wrapped by hand the way
    /// PatientImageController does.
    /// </summary>
    [HttpPost]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> CreateWithPicturesAsync(
        [FromForm] CreateLaboOrderDto input,
        [FromForm] List<IFormFile>? pictures)
    {
        input.Pictures = pictures?
            .Select(file => (IRemoteStreamContent)new RemoteStreamContent(
                file.OpenReadStream(), file.FileName, file.ContentType, file.Length))
            .ToList();
        return service.CreateAsync(input);
    }

    [HttpPut("{id:guid}")]
    public Task<LaboOrderDto> UpdateAsync(Guid id, [FromBody] UpdateLaboOrderDto input) =>
        service.UpdateAsync(id, input);

    /// <summary>The detail dialog's Lưu: the status picked and the pictures added, as one multipart PUT.</summary>
    [HttpPut("{id:guid}/detail")]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> SaveDetailAsync(
        Guid id,
        [FromForm] SaveLaboOrderDetailDto input,
        [FromForm] List<IFormFile>? pictures,
        [FromForm] List<Guid>? keepImageIds)
    {
        // Bound by hand: the DTO's own binder leaves a repeated form key empty
        // when the request carries none, and "none kept" must read as "remove all".
        input.KeepImageIds = keepImageIds ?? [];
        input.Pictures = pictures?
            .Select(file => (IRemoteStreamContent)new RemoteStreamContent(
                file.OpenReadStream(), file.FileName, file.ContentType, file.Length))
            .ToList();
        return service.SaveDetailAsync(id, input);
    }

    [HttpPost("{id:guid}/send")]
    public Task SendAsync(Guid id) => service.SendAsync(id);

    [HttpPost("{id:guid}/receive")]
    public Task ReceiveAsync(Guid id) => service.ReceiveAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] GetLaboOrderListInput input) =>
        Excel(await service.ExportAsync(input), "labo");

    [HttpPost("{id:guid}/reject")]
    public Task RejectAsync(Guid id, [FromBody] string reason) => service.RejectAsync(id, reason);
}
