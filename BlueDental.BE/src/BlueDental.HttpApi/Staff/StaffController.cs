using System;
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

    [HttpGet("{id:guid}")]
    public Task<StaffDto> GetAsync(Guid id) => service.GetAsync(id);
}
