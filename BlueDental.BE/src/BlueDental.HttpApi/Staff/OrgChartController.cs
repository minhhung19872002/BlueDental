using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

/// <summary>Nhân sự → Sơ đồ tổ chức (F-67).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/org-chart")]
public sealed class OrgChartController(IOrgChartAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<OrgChartDto> GetAsync() => service.GetAsync();

    [HttpGet("next-code")]
    public Task<OrgUnitCodeDto> GetNextCodeAsync([FromQuery] OrgUnitKind kind) => service.GetNextCodeAsync(kind);

    [HttpGet("history")]
    public Task<PagedResultDto<OrgUnitChangeLogDto>> GetHistoryAsync([FromQuery] GetOrgChartHistoryInput input) =>
        service.GetHistoryAsync(input);

    [HttpPost("units")]
    public Task<OrgUnitDto> CreateAsync([FromBody] CreateOrgUnitDto input) => service.CreateAsync(input);

    [HttpPut("units/{id:guid}")]
    public Task<OrgUnitDto> UpdateAsync(Guid id, [FromBody] UpdateOrgUnitDto input) => service.UpdateAsync(id, input);

    [HttpDelete("units/{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPut("root/head")]
    public Task<OrgUnitDto> ChangeRootHeadAsync([FromBody] ChangeOrgRootHeadDto input) =>
        service.ChangeRootHeadAsync(input);

    [HttpPost("assign")]
    public Task AssignAsync([FromBody] AssignOrgUnitMembersDto input) => service.AssignAsync(input);
}
