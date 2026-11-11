using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Auditing;
using Volo.Abp.Content;

namespace BlueDental.Imaging;

/// <summary>Cài đặt → Máy X-quang (F-95).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/xray-devices")]
public sealed class XrayDeviceController(IXrayDeviceAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<List<XrayDeviceDto>> GetListAsync([FromQuery] Guid clinicBranchId) =>
        service.GetListAsync(clinicBranchId);

    [HttpPost]
    public Task<PairedXrayDeviceDto> CreateAsync([FromBody] CreateXrayDeviceDto input) =>
        service.CreateAsync(input);

    [HttpPost("{id:guid}/revoke")]
    public Task RevokeAsync(Guid id) => service.RevokeAsync(id);

    [HttpGet("has-active")]
    public Task<bool> HasActiveAsync([FromQuery] Guid clinicBranchId) => service.HasActiveAsync(clinicBranchId);
}

/// <summary>Ảnh chưa gán hồ sơ (F-95).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/xray-inbox")]
public sealed class XrayInboxController(IXrayInboxAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<XrayInboxItemDto>> GetListAsync([FromQuery] GetXrayInboxListInput input) =>
        service.GetListAsync(input);

    [HttpGet("count")]
    public Task<int> GetCountAsync([FromQuery] Guid? clinicBranchId) => service.GetCountAsync(clinicBranchId);

    [HttpGet("{id:guid}/content")]
    public async Task<IActionResult> GetContentAsync(Guid id)
    {
        var content = await service.GetContentAsync(id);
        return File(content.GetStream(), content.ContentType ?? "application/octet-stream");
    }

    [HttpGet("{id:guid}/suggestions")]
    public Task<List<XrayPatientSuggestionDto>> GetSuggestionsAsync(Guid id) => service.GetSuggestionsAsync(id);

    [HttpPost("{id:guid}/assign")]
    public Task<Guid> AssignAsync(Guid id, [FromBody] AssignXrayInboxItemDto input) => service.AssignAsync(id, input);

    [HttpPost("{id:guid}/discard")]
    public Task DiscardAsync(Guid id) => service.DiscardAsync(id);
}

/// <summary>
/// What BlueDental.XrayAgent on the X-ray PC calls; no sign-in, the device
/// token (in a header) is the key.
/// </summary>
// Not audited: every call carries the device token, which the audit log would keep in clear.
[RemoteService]
[AllowAnonymous]
[DisableAuditing]
[Route("api/v1/public/xray-station")]
public sealed class XrayStationController(IXrayStationAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<XrayStationDto> PingAsync([FromHeader(Name = XrayDeviceConsts.TokenHeader)] string? token) =>
        service.PingAsync(token);

    /// <summary>Multipart: the picture plus what the agent read off its file name.</summary>
    [HttpPost("images")]
    public Task<XrayReceiveResultDto> ReceiveImageAsync(
        [FromHeader(Name = XrayDeviceConsts.TokenHeader)] string? token,
        IFormFile? file,
        [FromForm] string? code,
        [FromForm] string? name,
        [FromForm] int? birthYear,
        [FromForm] DateTimeOffset? capturedAt)
    {
        return service.ReceiveImageAsync(token, new ReceiveXrayImageDto
        {
            File = file == null
                ? null
                : new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType, file.Length),
            Code = code,
            Name = name,
            BirthYear = birthYear,
            CapturedAt = capturedAt,
        });
    }

    [HttpGet("patients/by-code")]
    public Task<XrayStationPatientDto> GetPatientByCodeAsync(
        [FromHeader(Name = XrayDeviceConsts.TokenHeader)] string? token,
        [FromQuery] string code) =>
        service.GetPatientByCodeAsync(token, code);
}
