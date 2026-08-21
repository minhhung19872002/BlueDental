using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

[RemoteService]
[Authorize]
[Route("api/v1/app/patients")]
public sealed class PatientController(IPatientAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientDto>> GetListAsync([FromQuery] GetPatientListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientDto> RegisterAsync([FromBody] RegisterPatientDto input) =>
        service.RegisterAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientDto> UpdateAsync(Guid id, [FromBody] UpdatePatientDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/deactivate")]
    public Task DeactivateAsync(Guid id) => service.DeactivateAsync(id);
}
