using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Inventory;

[RemoteService]
[Authorize]
[Route("api/v1/app/material-allocations")]
public sealed class MaterialAllocationController(IMaterialAllocationAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(
        [FromQuery] GetMaterialAllocationListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<MaterialAllocationDto> CreateAsync([FromBody] CreateMaterialAllocationDto input) =>
        service.CreateAsync(input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
