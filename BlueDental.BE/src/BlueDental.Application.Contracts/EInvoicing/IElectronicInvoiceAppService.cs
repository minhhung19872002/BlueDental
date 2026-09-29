using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>
/// "Xuất hóa đơn điện tử" on a receipt: creates the invoice at the e-invoice
/// provider and keeps BlueDental's record of it in step.
/// </summary>
public interface IElectronicInvoiceAppService : IApplicationService
{
    /// <summary>
    /// Creates a draft invoice at the provider for a payment receipt. Calling
    /// it again while the invoice is still a draft rewrites that draft.
    /// </summary>
    Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId);

    Task<ListResultDto<ElectronicInvoiceDto>> GetListAsync(GetElectronicInvoiceListInput input);

    /// <summary>Asks the provider where the invoice stands now (signed, numbered…).</summary>
    Task<ElectronicInvoiceDto> SyncAsync(Guid id);

    /// <summary>The invoice as the provider renders it.</summary>
    Task<byte[]> GetPdfAsync(Guid id);
}
