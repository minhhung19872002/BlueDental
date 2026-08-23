using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class InsurancePlanAppService : ApplicationService, IInsurancePlanAppService
{
    private readonly IRepository<InsurancePlan, Guid> _repository;

    public InsurancePlanAppService(IRepository<InsurancePlan, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<InsurancePlanDto>> GetListAsync(GetInsurancePlanListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(p =>
                p.Name.Contains(input.Filter) ||
                p.Code.Contains(input.Filter));

        if (input.IsActive.HasValue)
            query = query.Where(p => p.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<InsurancePlanDto>(
            totalCount,
            ObjectMapper.Map<List<InsurancePlan>, List<InsurancePlanDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<InsurancePlanDto> GetAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        return ObjectMapper.Map<InsurancePlan, InsurancePlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<InsurancePlanDto> CreateAsync(CreateInsurancePlanDto input)
    {
        var plan = new InsurancePlan(
            GuidGenerator.Create(),
            input.Code,
            input.Name,
            input.CoveragePercentage,
            input.ProviderName);

        plan.UpdateCoverage(input.CoveragePercentage, input.MaxAnnualBenefit);

        await _repository.InsertAsync(plan, autoSave: true);
        return ObjectMapper.Map<InsurancePlan, InsurancePlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<InsurancePlanDto> UpdateAsync(Guid id, UpdateInsurancePlanDto input)
    {
        var plan = await _repository.GetAsync(id);
        plan.UpdateCoverage(input.CoveragePercentage, input.MaxAnnualBenefit);
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<InsurancePlan, InsurancePlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task DeleteAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        plan.Deactivate();
        await _repository.UpdateAsync(plan, autoSave: true);
    }
}
