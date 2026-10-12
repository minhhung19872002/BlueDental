using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.EInvoicing;

/// <summary>Yêu cầu xuất HĐ on the patient's Hóa đơn tab.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/invoice-requests")]
public sealed class InvoiceRequestController(IInvoiceRequestAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<InvoiceRequestDto>> GetListAsync([FromQuery] GetInvoiceRequestListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<InvoiceRequestStatsDto> GetStatsAsync([FromQuery] GetInvoiceRequestStatsInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("payment-options/{patientId:guid}")]
    public Task<List<InvoiceRequestPaymentOptionDto>> GetPaymentOptionsAsync(Guid patientId) =>
        service.GetPaymentOptionsAsync(patientId);

    [HttpGet("draft/{patientPaymentId:guid}")]
    public Task<InvoiceRequestDraftDto> GetDraftAsync(Guid patientPaymentId) =>
        service.GetDraftAsync(patientPaymentId);

    [HttpPost("links/{patientPaymentId:guid}")]
    public Task<InvoiceRequestLinkDto> GetLinkAsync(Guid patientPaymentId) => service.GetLinkAsync(patientPaymentId);

    [HttpGet("{id:guid}")]
    public Task<InvoiceRequestDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<InvoiceRequestDto> CreateAsync([FromBody] CreateInvoiceRequestDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<InvoiceRequestDto> UpdateAsync(Guid id, [FromBody] UpdateInvoiceRequestDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/start")]
    public Task<InvoiceRequestDto> StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/needs-info")]
    public Task<InvoiceRequestDto> RequestMoreInfoAsync(Guid id, [FromBody] InvoiceRequestReasonDto input) =>
        service.RequestMoreInfoAsync(id, input);

    [HttpPost("{id:guid}/complete")]
    public Task<InvoiceRequestDto> CompleteAsync(Guid id, [FromBody] CompleteInvoiceRequestDto input) =>
        service.CompleteAsync(id, input);

    [HttpPost("{id:guid}/cancel")]
    public Task<InvoiceRequestDto> CancelAsync(Guid id, [FromBody] InvoiceRequestReasonDto input) =>
        service.CancelAsync(id, input);
}

/// <summary>The page behind the QR on a PHIẾU THU; no sign-in, the token is the key.</summary>
[RemoteService]
[AllowAnonymous]
[Route("api/v1/public/invoice-requests")]
public sealed class PublicInvoiceRequestController(IPublicInvoiceRequestAppService service) : BlueDentalController
{
    [HttpGet("{token}")]
    public Task<PublicInvoiceRequestFormDto> GetFormAsync(string token) => service.GetFormAsync(token);

    [HttpPost("{token}")]
    public Task<PublicInvoiceRequestResultDto> SubmitAsync(string token, [FromBody] SubmitPublicInvoiceRequestDto input) =>
        service.SubmitAsync(token, input);
}
