using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Inventory;

[Authorize(BlueDentalPermissions.Inventory.Default)]
public class MaterialAllocationAppService : ApplicationService, IMaterialAllocationAppService
{
    private readonly IRepository<MaterialAllocation, Guid> _repository;
    private readonly IRepository<InventoryItem, Guid> _inventoryItemRepository;
    private readonly IRepository<Department, Guid> _departmentRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public MaterialAllocationAppService(
        IRepository<MaterialAllocation, Guid> repository,
        IRepository<InventoryItem, Guid> inventoryItemRepository,
        IRepository<Department, Guid> departmentRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _inventoryItemRepository = inventoryItemRepository;
        _departmentRepository = departmentRepository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Inventory.View)]
    public async Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(GetMaterialAllocationListInput input)
    {
        // Vouchers belong to a branch. Without this every branch read every
        // other branch's allocations.
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var queryable = await _repository.GetQueryableAsync();
        queryable = queryable.Where(x => x.BranchId == branchId);

        if (input.DepartmentId.HasValue)
        {
            queryable = queryable.Where(x => x.DepartmentId == input.DepartmentId.Value);
        }

        // Every word typed has to appear somewhere in the row, in any order and
        // whatever the casing — the same rule the rest of the app searches by.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            queryable = queryable.Where(x =>
                x.AllocationCode.ToLower().Contains(term) ||
                (x.PerformerName != null && x.PerformerName.ToLower().Contains(term)) ||
                (x.Note != null && x.Note.ToLower().Contains(term)));
        }

        var totalCount = queryable.Count();
        var items = queryable
            .OrderByDescending(x => x.AllocationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = ObjectMapper.Map<System.Collections.Generic.List<MaterialAllocation>, System.Collections.Generic.List<MaterialAllocationDto>>(items);

        var itemIds = items.Select(x => x.InventoryItemId).Distinct().ToList();
        var deptIds = items.Select(x => x.DepartmentId).Distinct().ToList();

        var inventoryItems = (await _inventoryItemRepository.GetQueryableAsync())
            .Where(x => itemIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToList()
            .ToDictionary(x => x.Id, x => x.Name);

        var departments = (await _departmentRepository.GetQueryableAsync())
            .Where(x => deptIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToList()
            .ToDictionary(x => x.Id, x => x.Name);

        foreach (var dto in dtos)
        {
            dto.InventoryItemName = inventoryItems.GetValueOrDefault(dto.InventoryItemId);
            dto.DepartmentName = departments.GetValueOrDefault(dto.DepartmentId);
        }

        return new PagedResultDto<MaterialAllocationDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<MaterialAllocationDto> CreateAsync(CreateMaterialAllocationDto input)
    {
        var allocationCode = $"PB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var entity = new MaterialAllocation(
            GuidGenerator.Create(),
            allocationCode,
            input.InventoryItemId,
            input.DepartmentId,
            // This slot is the branch. It used to be handed CurrentUser.Id, so
            // every voucher was stamped with the person who raised it and
            // belonged to no branch at all.
            _branchResolver.GetRequiredClinicBranchId(),
            input.AllocatedQuantity,
            input.PerformerName,
            input.Note);

        await _repository.InsertAsync(entity);
        return ObjectMapper.Map<MaterialAllocation, MaterialAllocationDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var entity = await _repository.GetAsync(id);

        if (entity.BranchId != branchId)
        {
            throw new Volo.Abp.Domain.Entities.EntityNotFoundException(
                typeof(MaterialAllocation), id);
        }

        await _repository.DeleteAsync(entity);
    }
}
