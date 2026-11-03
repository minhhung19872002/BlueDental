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
    /// The Đặt hàng tab's Lưu nháp / Tạo phiếu Labo: the same fields as form
    /// values plus the Hình ảnh gửi Labo under <c>pictures</c>, so the order
    /// and its pictures land in one request. Routed by content type; the file
    /// parts are wrapped by hand the way PatientImageController does.
    /// </summary>
    [HttpPost]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> CreateWithPicturesAsync(
        [FromForm] CreateLaboOrderDto input,
        [FromForm] List<IFormFile>? pictures)
    {
        input.Pictures = Wrap(pictures);
        return service.CreateAsync(input);
    }

    /// <summary>JSON update of a Nháp; <c>keepImageIds</c> left out keeps every picture.</summary>
    [HttpPut("{id:guid}")]
    [Consumes("application/json")]
    public Task<LaboOrderDto> UpdateAsync(Guid id, [FromBody] UpdateLaboOrderDto input) =>
        service.UpdateAsync(id, input);

    /// <summary>The Đặt hàng tab saved again with the pictures kept and added.</summary>
    [HttpPut("{id:guid}")]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> UpdateWithPicturesAsync(
        Guid id,
        [FromForm] UpdateLaboOrderDto input,
        [FromForm] List<IFormFile>? pictures,
        [FromForm] List<Guid>? keepImageIds)
    {
        // Bound by hand: the DTO's own binder leaves a repeated form key empty
        // when the request carries none, and "none kept" must read as "remove all".
        input.KeepImageIds = keepImageIds ?? [];
        input.Pictures = Wrap(pictures);
        return service.UpdateAsync(id, input);
    }

    [HttpPost("{id:guid}/cancel")]
    public Task<LaboOrderDto> CancelAsync(Guid id) => service.CancelAsync(id);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPost("{id:guid}/receive")]
    public Task<LaboOrderDto> ReceiveAsync(Guid id, [FromBody] ReceiveLaboOrderDto input) =>
        service.ReceiveAsync(id, input);

    /// <summary>
    /// Kiểm tra từng răng + Kết luận, with the Ảnh kiểm tra as <c>pictures</c>
    /// and each tooth as <c>teeth[i].toothNumber / result / note</c>.
    /// </summary>
    [HttpPost("{id:guid}/check")]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> CheckAsync(
        Guid id,
        [FromForm] CheckLaboOrderDto input,
        [FromForm] List<IFormFile>? pictures)
    {
        input.Pictures = Wrap(pictures);
        return service.CheckAsync(id, input);
    }

    /// <summary>JSON Kích hoạt bảo hành, without Ảnh thẻ.</summary>
    [HttpPost("{id:guid}/warranty")]
    [Consumes("application/json")]
    public Task<LaboOrderDto> ActivateWarrantyAsync(Guid id, [FromBody] ActivateLaboWarrantyDto input) =>
        service.ActivateWarrantyAsync(id, input);

    /// <summary>
    /// Kích hoạt bảo hành with the Ảnh thẻ (P3110 REQ-E1) as <c>cardPhotos</c>,
    /// each named by <c>cardPhotoTeeth</c> and <c>cardPhotoSides</c>.
    /// </summary>
    [HttpPost("{id:guid}/warranty")]
    [Consumes("multipart/form-data")]
    public Task<LaboOrderDto> ActivateWarrantyWithPhotosAsync(Guid id, [FromForm] ActivateLaboWarrantyDto input) =>
        service.ActivateWarrantyAsync(id, input);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] GetLaboOrderListInput input) =>
        Excel(await service.ExportAsync(input), "labo");

    private static List<IRemoteStreamContent>? Wrap(List<IFormFile>? files) =>
        files?
            .Select(file => (IRemoteStreamContent)new RemoteStreamContent(
                file.OpenReadStream(), file.FileName, file.ContentType, file.Length))
            .ToList();
}
