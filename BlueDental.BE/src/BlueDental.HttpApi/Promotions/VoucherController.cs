using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Promotions;

[RemoteService]
[Authorize]
[Route("api/v1/app/vouchers")]
public sealed class VoucherController(IVoucherAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<VoucherDto>> GetListAsync([FromQuery] GetVoucherListInput input) =>
        service.GetListAsync(input);

    [HttpGet("available")]
    public Task<List<VoucherDto>> GetAvailableAsync([FromQuery] GetAvailableVouchersInput input) =>
        service.GetAvailableAsync(input);

    [HttpGet("{id:guid}")]
    public Task<VoucherDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("code-prefix")]
    public Task<VoucherCodePrefixDto> GetCodePrefixAsync() => service.GetCodePrefixAsync();

    [HttpPost]
    public Task<VoucherDto> CreateAsync([FromBody] CreateVoucherDto input) => service.CreateAsync(input);

    [HttpPost("batch")]
    public Task<List<VoucherDto>> CreateBatchAsync([FromBody] CreateVoucherBatchDto input) =>
        service.CreateBatchAsync(input);

    [HttpPut("{id:guid}")]
    public Task<VoucherDto> UpdateAsync(Guid id, [FromBody] UpdateVoucherDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/publish")]
    public Task<VoucherDto> PublishAsync(Guid id) => service.PublishAsync(id);

    [HttpPost("{id:guid}/unpublish")]
    public Task<VoucherDto> UnpublishAsync(Guid id) => service.UnpublishAsync(id);

    [HttpPost("{id:guid}/redeem")]
    public Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, [FromBody] RedeemVoucherInput input) =>
        service.RedeemAsync(id, input);

    [HttpPost("expire-outdated")]
    public Task<int> ExpireOutdatedAsync([FromQuery] DateOnly asOf) => service.ExpireOutdatedAsync(asOf);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
