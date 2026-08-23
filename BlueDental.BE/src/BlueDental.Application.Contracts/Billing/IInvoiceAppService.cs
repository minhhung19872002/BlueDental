using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Billing;

public interface IInvoiceAppService : IApplicationService
{
    Task<PagedResultDto<InvoiceDto>> GetListAsync(GetInvoiceListInput input);
    Task<InvoiceDto> GetAsync(Guid id);
    Task<InvoiceDto> CreateAsync(CreateInvoiceDto input);
    Task<InvoiceDto> IssueAsync(Guid id);
    Task<InvoiceDto> RecordPaymentAsync(Guid id, RecordPaymentDto input);
    Task<InvoiceDto> VoidAsync(Guid id, VoidInvoiceDto input);

    /// <summary>"Xuất Excel" on the Thanh toán screen.</summary>
    Task<byte[]> ExportAsync(GetInvoiceListInput input);
}
