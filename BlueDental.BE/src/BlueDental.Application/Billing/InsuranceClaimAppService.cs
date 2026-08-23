using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

[Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Default)]
public class InsuranceClaimAppService : ApplicationService, IInsuranceClaimAppService
{
    private readonly IRepository<InsuranceClaim, Guid> _repository;

    public InsuranceClaimAppService(IRepository<InsuranceClaim, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.View)]
    public async Task<PagedResultDto<InsuranceClaimDto>> GetListAsync(GetInsuranceClaimListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.PatientId.HasValue)
            query = query.Where(c => c.PatientId == input.PatientId.Value);

        if (input.Status.HasValue)
            query = query.Where(c => c.Status == input.Status.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(c => c.ClaimReference.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(c => c.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<InsuranceClaimDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<InsuranceClaim>, System.Collections.Generic.List<InsuranceClaimDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.View)]
    public async Task<InsuranceClaimDto> GetAsync(Guid id)
    {
        var claim = await _repository.GetAsync(id);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Submit)]
    public async Task<InsuranceClaimDto> CreateAsync(CreateInsuranceClaimDto input)
    {
        var claimReference = $"IC-{Clock.Now:yyyyMMdd}-{GuidGenerator.Create().ToString("N")[..6].ToUpper()}";

        var claim = new InsuranceClaim(
            GuidGenerator.Create(),
            input.InvoiceId,
            input.PatientId,
            input.InsurancePlanId,
            claimReference,
            new Money(input.ClaimedAmount));

        await _repository.InsertAsync(claim, autoSave: true);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Submit)]
    public async Task<InsuranceClaimDto> SubmitAsync(Guid id)
    {
        var claim = await _repository.GetAsync(id);
        claim.Submit();
        await _repository.UpdateAsync(claim, autoSave: true);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Process)]
    public async Task<InsuranceClaimDto> ApproveAsync(Guid id, ApproveInsuranceClaimDto input)
    {
        var claim = await _repository.GetAsync(id);
        claim.Approve(new Money(input.ApprovedAmount));
        await _repository.UpdateAsync(claim, autoSave: true);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Process)]
    public async Task<InsuranceClaimDto> RejectAsync(Guid id, RejectInsuranceClaimDto input)
    {
        var claim = await _repository.GetAsync(id);
        claim.Reject(input.Reason);
        await _repository.UpdateAsync(claim, autoSave: true);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }

    [Authorize(BlueDentalPermissions.Billing.InsuranceClaims.Process)]
    public async Task<InsuranceClaimDto> SettleAsync(Guid id)
    {
        var claim = await _repository.GetAsync(id);
        claim.Settle();
        await _repository.UpdateAsync(claim, autoSave: true);
        return ObjectMapper.Map<InsuranceClaim, InsuranceClaimDto>(claim);
    }
}
