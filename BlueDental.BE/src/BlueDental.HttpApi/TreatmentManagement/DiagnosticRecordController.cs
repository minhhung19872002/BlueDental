using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

[RemoteService]
[Authorize]
[Route("api/v1/app/diagnostic-records")]
public sealed class DiagnosticRecordController(IDiagnosticRecordAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<DiagnosticRecordDto>> GetListAsync(
        [FromQuery] GetDiagnosticRecordListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<DiagnosticRecordDto> CreateAsync(CreateDiagnosticRecordDto input) =>
        service.CreateAsync(input);

    [HttpDelete("{id}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
