using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Finance;

/// <summary>
/// Danh mục thu chi và danh mục luân chuyển.
/// </summary>
[Authorize(BlueDentalPermissions.Finance.Default)]
public class CashflowCategoryAppService : ApplicationService, ICashflowCategoryAppService
{
    private readonly IRepository<CashflowCategory, Guid> _repository;
    private readonly IRepository<SalesEntry, Guid> _salesRepository;
    private readonly IRepository<CashflowEntry, Guid> _cashflowRepository;

    public CashflowCategoryAppService(
        IRepository<CashflowCategory, Guid> repository,
        IRepository<SalesEntry, Guid> salesRepository,
        IRepository<CashflowEntry, Guid> cashflowRepository)
    {
        _repository = repository;
        _salesRepository = salesRepository;
        _cashflowRepository = cashflowRepository;
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<PagedResultDto<CashflowCategoryDto>> GetListAsync(GetCashflowCategoryListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.ClinicBranchId.HasValue)
            query = query.Where(x => x.ClinicBranchId == input.ClinicBranchId.Value);
        if (input.Type.HasValue)
            query = query.Where(x => x.Type == input.Type.Value);
        if (input.AppliesToTransfers.HasValue)
            query = query.Where(x => x.AppliesToTransfers == input.AppliesToTransfers.Value);
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<CashflowCategoryDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<CashflowCategoryDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<CashflowCategoryDto> CreateAsync(CreateCashflowCategoryDto input)
    {
        var category = CashflowCategory.Create(
            GuidGenerator.Create(),
            input.ClinicBranchId,
            input.Name,
            input.Type,
            input.AppliesToTransfers,
            isSystem: false,
            input.SortOrder,
            input.Description);

        await _repository.InsertAsync(category, autoSave: true);
        return MapToDto(category);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<CashflowCategoryDto> UpdateAsync(Guid id, UpdateCashflowCategoryDto input)
    {
        var category = await _repository.GetAsync(id);

        category.Rename(input.Name);
        category.UpdateDescription(input.Description);
        category.Reorder(input.SortOrder);

        if (input.IsActive)
        {
            category.Activate();
        }
        else
        {
            category.Deactivate();
        }

        await _repository.UpdateAsync(category, autoSave: true);
        return MapToDto(category);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var category = await _repository.GetAsync(id);

        if (category.IsSystem)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.SystemCategoryLocked,
                "A system cashflow category cannot be deleted.");
        }

        var salesQuery = await _salesRepository.GetQueryableAsync();
        var cashflowQuery = await _cashflowRepository.GetQueryableAsync();

        if (salesQuery.Any(x => x.CategoryId == id) || cashflowQuery.Any(x => x.CategoryId == id))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.SystemCategoryLocked,
                "This category is in use and cannot be deleted; deactivate it instead.");
        }

        await _repository.DeleteAsync(id, autoSave: true);
    }

    private static CashflowCategoryDto MapToDto(CashflowCategory entity) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Name = entity.Name,
        Type = entity.Type,
        AppliesToTransfers = entity.AppliesToTransfers,
        IsSystem = entity.IsSystem,
        IsActive = entity.IsActive,
        SortOrder = entity.SortOrder,
        Description = entity.Description,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
