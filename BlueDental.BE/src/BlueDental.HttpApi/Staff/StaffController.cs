using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

[RemoteService]
[Authorize]
[Route("api/v1/app/staff")]
public sealed class StaffController(IStaffAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<StaffDto>> GetListAsync([FromQuery] GetStaffListInput input) =>
        service.GetListAsync(input);

    [HttpGet("roles")]
    public Task<List<string>> GetRoleNamesAsync() => service.GetRoleNamesAsync();

    [HttpGet("{id:guid}")]
    public Task<StaffDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<StaffDto> CreateAsync([FromBody] CreateStaffDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<StaffDto> UpdateAsync(Guid id, [FromBody] UpdateStaffDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
