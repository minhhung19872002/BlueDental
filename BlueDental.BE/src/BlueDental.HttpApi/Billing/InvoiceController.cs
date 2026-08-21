using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Billing;

[RemoteService]
[Authorize]
[Route("api/v1/app/invoices")]
public sealed class InvoiceController(IInvoiceAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<InvoiceDto>> GetListAsync([FromQuery] GetInvoiceListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<InvoiceDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<InvoiceDto> CreateAsync([FromBody] CreateInvoiceDto input) =>
        service.CreateAsync(input);

    [HttpPost("{id:guid}/issue")]
    public Task<InvoiceDto> IssueAsync(Guid id) => service.IssueAsync(id);

    [HttpPost("{id:guid}/payment")]
    public Task<InvoiceDto> RecordPaymentAsync(Guid id, [FromBody] RecordPaymentDto input) =>
        service.RecordPaymentAsync(id, input);

    [HttpPost("{id:guid}/void")]
    public Task<InvoiceDto> VoidAsync(Guid id, [FromBody] VoidInvoiceDto input) =>
        service.VoidAsync(id, input);
}
