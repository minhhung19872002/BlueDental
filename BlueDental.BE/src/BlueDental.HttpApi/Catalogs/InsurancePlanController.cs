using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

[RemoteService]
[Authorize]
[Route("api/v1/app/insurance-plans")]
public sealed class InsurancePlanController(IInsurancePlanAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<InsurancePlanDto>> GetListAsync([FromQuery] GetInsurancePlanListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<InsurancePlanDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<InsurancePlanDto> CreateAsync([FromBody] CreateInsurancePlanDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<InsurancePlanDto> UpdateAsync(Guid id, [FromBody] UpdateInsurancePlanDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
