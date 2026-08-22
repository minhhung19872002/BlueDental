using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Promotions;

/// <summary>Voucher khuyến mãi.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/vouchers")]
public sealed class VoucherController(IVoucherAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<VoucherDto>> GetListAsync([FromQuery] GetVoucherListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<VoucherStatsDto> GetStatsAsync([FromQuery] Guid? clinicBranchId) =>
        service.GetStatsAsync(clinicBranchId);

    [HttpGet("available")]
    public Task<List<VoucherDto>> GetAvailableAsync([FromQuery] GetAvailableVouchersInput input) =>
        service.GetAvailableAsync(input);

    [HttpGet("{id:guid}")]
    public Task<VoucherDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<VoucherDto> CreateAsync([FromBody] CreateVoucherDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<VoucherDto> UpdateAsync(Guid id, [FromBody] UpdateVoucherDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/activate")]
    public Task<VoucherDto> ActivateAsync(Guid id) => service.ActivateAsync(id);

    [HttpPost("{id:guid}/pause")]
    public Task<VoucherDto> PauseAsync(Guid id) => service.PauseAsync(id);

    [HttpPost("{id:guid}/redeem")]
    public Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, [FromBody] RedeemVoucherInput input) =>
        service.RedeemAsync(id, input);

    [HttpPost("expire-outdated")]
    public Task<int> ExpireOutdatedAsync([FromQuery] DateOnly asOf) => service.ExpireOutdatedAsync(asOf);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
