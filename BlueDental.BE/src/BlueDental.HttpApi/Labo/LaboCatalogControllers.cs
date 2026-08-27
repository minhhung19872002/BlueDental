using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Content;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Labo;

/// <summary>
/// Nhà cung cấp Labo — /labo/supplier.
///
/// Declared rather than left to ABP's conventional controllers, because the
/// route the convention produces is not the one the client calls: the rest of
/// BlueDental is served from <c>api/v1/app/...</c>, and without this the
/// supplier list answered 404.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/labo-suppliers")]
public sealed class LaboSupplierController(ILaboSupplierAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<LaboSupplierDto>> GetListAsync(
        [FromQuery] GetLaboSupplierListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<LaboSupplierDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<LaboSupplierDto> CreateAsync([FromBody] CreateLaboSupplierDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<LaboSupplierDto> UpdateAsync(Guid id, [FromBody] UpdateLaboSupplierDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPost("{id:guid}/logo")]
    public Task<LaboSupplierLogoDto> UploadLogoAsync(Guid id, [FromForm] IFormFile file) =>
        service.UploadLogoAsync(id, new RemoteStreamContent(
            file.OpenReadStream(), file.FileName, file.ContentType, file.Length));

    [HttpDelete("{id:guid}/logo")]
    public Task DeleteLogoAsync(Guid id) => service.DeleteLogoAsync(id);

    /// <summary>
    /// Serves the logo back; the blob itself is never public.
    ///
    /// The type comes from the stored file's own extension rather than being
    /// assumed — a PNG announced as a JPEG only works because browsers sniff.
    /// </summary>
    [HttpGet("{id:guid}/logo")]
    public async Task<IActionResult> GetLogoAsync(Guid id)
    {
        var supplier = await service.GetAsync(id);
        var contentType = (supplier.LogoFileId ?? string.Empty) switch
        {
            var name when name.EndsWith(".png", StringComparison.OrdinalIgnoreCase) => "image/png",
            var name when name.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) => "image/webp",
            _ => "image/jpeg",
        };

        return File(await service.GetLogoContentAsync(id), contentType);
    }
}

/// <summary>Vật liệu Labo — the right-hand table of /labo/service-material.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/labo-materials")]
public sealed class LaboMaterialController(ILaboMaterialAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<LaboMaterialDto>> GetListAsync(
        [FromQuery] GetLaboMaterialListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<LaboMaterialDto> CreateAsync([FromBody] CreateLaboMaterialDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<LaboMaterialDto> UpdateAsync(Guid id, [FromBody] UpdateLaboMaterialDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
