using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>
/// Hóa đơn điện tử: creates the invoice at the provider for a receipt or a
/// slip, under the branch's own account, and keeps BlueDental's record of it
/// in step.
/// </summary>
public interface IElectronicInvoiceAppService : IApplicationService
{
    /// <summary>The Hóa đơn dialog prefilled from the receipt or slip.</summary>
    Task<ElectronicInvoiceDraftDto> GetDraftAsync(GetElectronicInvoiceDraftInput input);

    /// <summary>
    /// Lưu Nháp (draft) or Phát Hành (sign). Calling it again while the
    /// invoice is still a draft rewrites that draft under the same key.
    /// </summary>
    Task<ElectronicInvoiceDto> IssueAsync(IssueElectronicInvoiceDto input);

    /// <summary>Shortcut for the receipt row: a draft with the prefilled lines.</summary>
    Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId);

    Task<ListResultDto<ElectronicInvoiceDto>> GetListAsync(GetElectronicInvoiceListInput input);

    /// <summary>Asks the provider where the invoice stands now (signed, numbered…).</summary>
    Task<ElectronicInvoiceDto> SyncAsync(Guid id);

    /// <summary>The invoice as the provider renders it.</summary>
    Task<byte[]> GetPdfAsync(Guid id);
}
