using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Promotions;

public interface IVoucherAppService : IApplicationService
{
    Task<PagedResultDto<VoucherDto>> GetListAsync(GetVoucherListInput input);
    Task<VoucherDto> GetAsync(Guid id);
    Task<List<VoucherDto>> GetAvailableAsync(GetAvailableVouchersInput input);
    Task<VoucherCodePrefixDto> GetCodePrefixAsync();
    Task<VoucherDto> CreateAsync(CreateVoucherDto input);
    Task<List<VoucherDto>> CreateBatchAsync(CreateVoucherBatchDto input);
    Task<VoucherDto> UpdateAsync(Guid id, UpdateVoucherDto input);
    Task<VoucherDto> PublishAsync(Guid id);
    Task<VoucherDto> UnpublishAsync(Guid id);
    Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, RedeemVoucherInput input);
    Task DeleteAsync(Guid id);
    Task<int> ExpireOutdatedAsync(DateOnly asOf);
}
