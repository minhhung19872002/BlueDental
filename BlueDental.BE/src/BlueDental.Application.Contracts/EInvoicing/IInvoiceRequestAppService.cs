using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>
/// Yêu cầu xuất HĐ: the THÔNG TIN XUẤT HÓA ĐƠN form for a receipt, sent by the
/// customer through the QR on the PHIẾU THU or keyed in by staff, and sent to
/// EasyInvoice by Xử lý; its status then follows the invoice there (P1811).
/// </summary>
public interface IInvoiceRequestAppService : IApplicationService
{
    Task<PagedResultDto<InvoiceRequestDto>> GetListAsync(GetInvoiceRequestListInput input);

    Task<InvoiceRequestStatsDto> GetStatsAsync(GetInvoiceRequestStatsInput input);

    Task<InvoiceRequestDto> GetAsync(Guid id);

    /// <summary>The patient's receipts that may still get a request, newest first.</summary>
    Task<List<InvoiceRequestPaymentOptionDto>> GetPaymentOptionsAsync(Guid patientId);

    /// <summary>The create dialog prefilled from the patient and the receipt.</summary>
    Task<InvoiceRequestDraftDto> GetDraftAsync(Guid patientPaymentId);

    /// <summary>The receipt's QR link (the one printed on its PHIẾU THU), made if it has none yet.</summary>
    Task<InvoiceRequestLinkDto> GetLinkAsync(Guid patientPaymentId);

    Task<InvoiceRequestDto> CreateAsync(CreateInvoiceRequestDto input);

    Task<InvoiceRequestDto> UpdateAsync(Guid id, UpdateInvoiceRequestDto input);

    /// <summary>
    /// Xử lý (Mới) / Xử lý lại (Đã hủy): sends the receipt's e-invoice to
    /// EasyInvoice with this buyer — Chờ xử lý until the accountant signs or
    /// cancels it on the portal (P1811).
    /// </summary>
    Task<InvoiceRequestDto> ProcessAsync(Guid id);

    /// <summary>Hủy yêu cầu (Đã hủy only on screen; the server also takes Mới).</summary>
    Task<InvoiceRequestDto> WithdrawAsync(Guid id, InvoiceRequestReasonDto input);
}

/// <summary>The page behind the QR — no sign-in; the token is the key.</summary>
public interface IPublicInvoiceRequestAppService : IApplicationService
{
    Task<PublicInvoiceRequestFormDto> GetFormAsync(string token);

    Task<PublicInvoiceRequestResultDto> SubmitAsync(string token, SubmitPublicInvoiceRequestDto input);
}
