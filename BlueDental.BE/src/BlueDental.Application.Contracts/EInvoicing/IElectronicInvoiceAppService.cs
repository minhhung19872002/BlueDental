using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>
/// Hóa đơn điện tử of a receipt or a slip: kept in BlueDental, sent unsigned to
/// the provider under the branch's own account, signed there by the accountant
/// (BA 2026-11-18), and read back.
/// </summary>
public interface IElectronicInvoiceAppService : IApplicationService
{
    /// <summary>The Hóa đơn dialog prefilled from the receipt or slip.</summary>
    Task<ElectronicInvoiceDraftDto> GetDraftAsync(GetElectronicInvoiceDraftInput input);

    /// <summary>
    /// Lưu Nháp (kept here, nothing sent) or Lưu (sent unsigned — "Chờ kiểm
    /// tra"). Lưu again while it waits rewrites that draft at the provider;
    /// after a cancel there it goes out as the next round of the same row.
    /// </summary>
    Task<ElectronicInvoiceDto> IssueAsync(IssueElectronicInvoiceDto input);

    /// <summary>Shortcut for the receipt row: Lưu Nháp with the prefilled lines.</summary>
    Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId);

    Task<ListResultDto<ElectronicInvoiceDto>> GetListAsync(GetElectronicInvoiceListInput input);

    /// <summary>Asks the provider where the invoice stands now (signed, cancelled…), as the sync does each minute.</summary>
    Task<ElectronicInvoiceDto> SyncAsync(Guid id);

    /// <summary>The signed PDF kept when it was signed, else the provider's rendering.</summary>
    Task<byte[]> GetPdfAsync(Guid id);

    /// <summary>PHIẾU THU of what the dialog holds, filled into the template and rendered as PDF.</summary>
    Task<byte[]> RenderReceiptAsync(RenderPaymentReceiptDto input);
}
