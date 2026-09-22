using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Billing;

[RemoteService]
[Authorize]
[Route("api/v1/app/insurance-claims")]
public sealed class InsuranceClaimController(IInsuranceClaimAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<InsuranceClaimDto>> GetListAsync([FromQuery] GetInsuranceClaimListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<InsuranceClaimDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<InsuranceClaimDto> CreateAsync([FromBody] CreateInsuranceClaimDto input) => service.CreateAsync(input);

    [HttpPost("{id:guid}/submit")]
    public Task<InsuranceClaimDto> SubmitAsync(Guid id) => service.SubmitAsync(id);

    [HttpPost("{id:guid}/approve")]
    public Task<InsuranceClaimDto> ApproveAsync(Guid id, [FromBody] ApproveInsuranceClaimDto input) =>
        service.ApproveAsync(id, input);

    [HttpPost("{id:guid}/reject")]
    public Task<InsuranceClaimDto> RejectAsync(Guid id, [FromBody] RejectInsuranceClaimDto input) =>
        service.RejectAsync(id, input);

    [HttpPost("{id:guid}/settle")]
    public Task<InsuranceClaimDto> SettleAsync(Guid id) => service.SettleAsync(id);
}
