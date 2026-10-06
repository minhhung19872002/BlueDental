using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Staff;

/// <summary>
/// Loại vi phạm — the per-branch list Chế tài picks from. Guarded by the
/// staffPenalty leaves: whoever may write a penalty may keep its list.
/// A deleted type is soft-deleted, so the records filed under it keep its name.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.StaffPenalty.Read)]
public class StaffViolationTypeAppService(
    IRepository<StaffViolationType, Guid> repository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : ApplicationService, IStaffViolationTypeAppService
{
    public async Task<PagedResultDto<StaffViolationTypeDto>> GetListAsync(GetStaffViolationTypeListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(query
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<StaffViolationTypeDto>(totalCount, items.Select(Map).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Create)]
    public async Task<StaffViolationTypeDto> CreateAsync(CreateStaffViolationTypeDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            branchResolver.GetRequiredClinicBranchId());

        await EnsureNameFreeAsync(branchId, input.Name, exceptId: null);

        var type = StaffViolationType.Create(GuidGenerator.Create(), branchId, input.Name, input.DefaultFineAmount);
        await repository.InsertAsync(type, autoSave: true);
        return Map(type);
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Update)]
    public async Task<StaffViolationTypeDto> UpdateAsync(Guid id, UpdateStaffViolationTypeDto input)
    {
        var type = await repository.GetAsync(id);
        await branchAccess.CheckAsync(type.ClinicBranchId);
        if (!CatalogNames.Same(type.Name, input.Name))
        {
            await EnsureNameFreeAsync(type.ClinicBranchId, input.Name, type.Id);
        }

        type.SetDetails(input.Name, input.DefaultFineAmount);
        await repository.UpdateAsync(type, autoSave: true);
        return Map(type);
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var type = await repository.GetAsync(id);
        await branchAccess.CheckAsync(type.ClinicBranchId);
        await repository.DeleteAsync(type, autoSave: true);
    }

    /// <summary>One name per type within a branch, case and stray spaces aside — the Danh mục rule.</summary>
    private async Task EnsureNameFreeAsync(Guid branchId, string name, Guid? exceptId)
    {
        var query = await repository.GetQueryableAsync();
        var taken = await AsyncExecuter.ToListAsync(query
            .Where(x => x.ClinicBranchId == branchId && x.Id != exceptId)
            .Select(x => x.Name));

        CatalogNames.EnsureFree(name, taken, BlueDentalDomainErrorCodes.StaffPenalty.DuplicateViolationTypeName);
    }

    private static StaffViolationTypeDto Map(StaffViolationType type) => new()
    {
        Id = type.Id,
        ClinicBranchId = type.ClinicBranchId,
        Name = type.Name,
        DefaultFineAmount = type.DefaultFineAmount,
        CreationTime = type.CreationTime,
    };
}
