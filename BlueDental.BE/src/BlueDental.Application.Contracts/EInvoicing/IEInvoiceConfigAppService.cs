using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.EInvoicing;

/// <summary>Công cụ › Hóa đơn › Cấu hình: each branch's e-invoice account.</summary>
public interface IEInvoiceConfigAppService : IApplicationService
{
    Task<ListResultDto<EInvoiceConfigDto>> GetListAsync(GetEInvoiceConfigListInput input);

    Task<EInvoiceConfigDto> GetAsync(Guid id);

    Task<EInvoiceConfigDto> CreateAsync(CreateUpdateEInvoiceConfigDto input);

    Task<EInvoiceConfigDto> UpdateAsync(Guid id, CreateUpdateEInvoiceConfigDto input);

    Task DeleteAsync(Guid id);
}
