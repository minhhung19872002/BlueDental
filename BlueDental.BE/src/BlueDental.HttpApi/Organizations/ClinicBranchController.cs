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
[Route("api/v1/app/clinic-branches")]
public sealed class ClinicBranchController(IClinicBranchAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<ClinicBranchDto>> GetListAsync(
        [FromQuery] GetClinicBranchListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<ClinicBranchDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<ClinicBranchDto> CreateAsync([FromBody] CreateClinicBranchDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<ClinicBranchDto> UpdateAsync(Guid id, [FromBody] UpdateClinicBranchDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
