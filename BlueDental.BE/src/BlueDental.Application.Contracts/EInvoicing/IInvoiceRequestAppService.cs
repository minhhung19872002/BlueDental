using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>
/// Yêu cầu xuất HĐ: the THÔNG TIN XUẤT HÓA ĐƠN form for a receipt, sent by the
/// customer through the QR on the PHIẾU THU or keyed in by staff, and worked by
/// the accountant to an invoice number.
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

    /// <summary>Xử lý.</summary>
    Task<InvoiceRequestDto> StartAsync(Guid id);

    /// <summary>Cần bổ sung.</summary>
    Task<InvoiceRequestDto> RequestMoreInfoAsync(Guid id, InvoiceRequestReasonDto input);

    /// <summary>Hoàn tất.</summary>
    Task<InvoiceRequestDto> CompleteAsync(Guid id, CompleteInvoiceRequestDto input);

    /// <summary>Hủy.</summary>
    Task<InvoiceRequestDto> CancelAsync(Guid id, InvoiceRequestReasonDto input);
}

/// <summary>The page behind the QR — no sign-in; the token is the key.</summary>
public interface IPublicInvoiceRequestAppService : IApplicationService
{
    Task<PublicInvoiceRequestFormDto> GetFormAsync(string token);

    Task<PublicInvoiceRequestResultDto> SubmitAsync(string token, SubmitPublicInvoiceRequestDto input);
}
