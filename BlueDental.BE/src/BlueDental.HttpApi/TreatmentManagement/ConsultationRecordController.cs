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
[Route("api/v1/app/consultation-records")]
public sealed class ConsultationRecordController(IConsultationRecordAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<ConsultationRecordDto>> GetListAsync(
        [FromQuery] GetConsultationRecordListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<ConsultationRecordDto> CreateAsync(CreateConsultationRecordDto input) =>
        service.CreateAsync(input);

    [HttpDelete("{id}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
