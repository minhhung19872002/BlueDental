using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.EInvoicing;

/// <summary>Công cụ › Hóa đơn › Cấu hình.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/e-invoice-configs")]
public sealed class EInvoiceConfigController(IEInvoiceConfigAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<EInvoiceConfigDto>> GetListAsync([FromQuery] GetEInvoiceConfigListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<EInvoiceConfigDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<EInvoiceConfigDto> CreateAsync([FromBody] CreateUpdateEInvoiceConfigDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<EInvoiceConfigDto> UpdateAsync(Guid id, [FromBody] CreateUpdateEInvoiceConfigDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
