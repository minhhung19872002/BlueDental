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
[Route("api/v1/app/dental-procedures")]
public sealed class DentalProcedureController(IDentalProcedureAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<DentalProcedureDto>> GetListAsync(
        [FromQuery] GetDentalProcedureListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<DentalProcedureDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<DentalProcedureDto> CreateAsync([FromBody] CreateDentalProcedureDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<DentalProcedureDto> UpdateAsync(Guid id, [FromBody] UpdateDentalProcedureDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
