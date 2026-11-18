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

    /// <summary>Xử lý / Xử lý lại: sends the e-invoice to EasyInvoice (P1811).</summary>
    [HttpPost("{id:guid}/process")]
    public Task<InvoiceRequestDto> ProcessAsync(Guid id) => service.ProcessAsync(id);

    /// <summary>Hủy yêu cầu.</summary>
    [HttpPost("{id:guid}/withdraw")]
    public Task<InvoiceRequestDto> WithdrawAsync(Guid id, [FromBody] InvoiceRequestReasonDto input) =>
        service.WithdrawAsync(id, input);
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
