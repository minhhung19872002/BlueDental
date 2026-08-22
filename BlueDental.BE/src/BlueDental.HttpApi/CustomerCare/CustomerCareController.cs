using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

[RemoteService]
[Authorize]
[Route("api/v1/app/care-records")]
public sealed class CustomerCareController(ICustomerCareAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<CareRecordDto>> GetListAsync([FromQuery] GetCareRecordListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<CareRecordDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<CareRecordDto> CreateAsync([FromBody] CreateCareRecordDto input) => service.CreateAsync(input);

    [HttpPost("{id:guid}/start")]
    public Task StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task CompleteAsync(Guid id, [FromBody] string resolution) => service.CompleteAsync(id, resolution);

    [HttpPost("{id:guid}/cancel")]
    public Task CancelAsync(Guid id) => service.CancelAsync(id);
}
