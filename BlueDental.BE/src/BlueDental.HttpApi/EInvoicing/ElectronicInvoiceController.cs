using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.EInvoicing;

/// <summary>Hóa đơn điện tử of a receipt or a slip.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/e-invoices")]
public sealed class ElectronicInvoiceController(IElectronicInvoiceAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<ElectronicInvoiceDto>> GetListAsync(
        [FromQuery] GetElectronicInvoiceListInput input) => service.GetListAsync(input);

    [HttpGet("draft")]
    public Task<ElectronicInvoiceDraftDto> GetDraftAsync(
        [FromQuery] GetElectronicInvoiceDraftInput input) => service.GetDraftAsync(input);

    [HttpPost("issue")]
    public Task<ElectronicInvoiceDto> IssueAsync([FromBody] IssueElectronicInvoiceDto input) =>
        service.IssueAsync(input);

    [HttpPost("issue-from-payment/{patientPaymentId:guid}")]
    public Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId) =>
        service.IssueFromPaymentAsync(patientPaymentId);

    [HttpPost("{id:guid}/sync")]
    public Task<ElectronicInvoiceDto> SyncAsync(Guid id) => service.SyncAsync(id);

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GetPdfAsync(Guid id) =>
        Pdf(await service.GetPdfAsync(id), $"hoa-don-dien-tu-{id:N}");
}
