using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Organizations;

[RemoteService]
[Authorize]
[Route("api/v1/app/departments")]
public sealed class DepartmentController(IDepartmentAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<DepartmentDto>> GetListAsync(
        [FromQuery] GetDepartmentListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<DepartmentDto> CreateAsync([FromBody] CreateDepartmentDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<DepartmentDto> UpdateAsync(Guid id, [FromBody] UpdateDepartmentDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPut("reorder")]
    public Task ReorderAsync([FromBody] ReorderDepartmentsDto input) =>
        service.ReorderAsync(input);
}
