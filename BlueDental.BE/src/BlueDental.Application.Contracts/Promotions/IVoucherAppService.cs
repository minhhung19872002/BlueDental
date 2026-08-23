using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Promotions;

/// <summary>
/// Voucher khuyến mãi — reference: <c>/api/v1/voucher/*</c>.
/// </summary>
public interface IVoucherAppService : IApplicationService
{
    Task<PagedResultDto<VoucherDto>> GetListAsync(GetVoucherListInput input);
    Task<VoucherStatsDto> GetStatsAsync(Guid? clinicBranchId);
    Task<VoucherDto> GetAsync(Guid id);

    /// <summary>Vouchers applicable to a given order — reference <c>/voucher/available</c>.</summary>
    Task<List<VoucherDto>> GetAvailableAsync(GetAvailableVouchersInput input);

    Task<VoucherDto> CreateAsync(CreateVoucherDto input);
    Task<VoucherDto> UpdateAsync(Guid id, UpdateVoucherDto input);
    Task<VoucherDto> ActivateAsync(Guid id);
    Task<VoucherDto> PauseAsync(Guid id);
    Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, RedeemVoucherInput input);
    Task DeleteAsync(Guid id);

    /// <summary>Expires vouchers whose validity window has passed.</summary>
    Task<int> ExpireOutdatedAsync(DateOnly asOf);
}
