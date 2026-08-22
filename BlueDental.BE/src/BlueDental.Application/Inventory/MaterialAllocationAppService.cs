using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Inventory;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class MaterialAllocationAppService : ApplicationService, IMaterialAllocationAppService
{
    private readonly IRepository<MaterialAllocation, Guid> _repository;
    private readonly IRepository<InventoryItem, Guid> _inventoryItemRepository;
    private readonly IRepository<Organizations.Department, Guid> _departmentRepository;

    public MaterialAllocationAppService(
        IRepository<MaterialAllocation, Guid> repository,
        IRepository<InventoryItem, Guid> inventoryItemRepository,
        IRepository<Organizations.Department, Guid> departmentRepository)
    {
        _repository = repository;
        _inventoryItemRepository = inventoryItemRepository;
        _departmentRepository = departmentRepository;
    }

    public async Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(GetMaterialAllocationListInput input)
    {
        var queryable = await _repository.GetQueryableAsync();

        if (input.DepartmentId.HasValue)
        {
            queryable = queryable.Where(x => x.DepartmentId == input.DepartmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.ToLowerInvariant();
            queryable = queryable.Where(x =>
                x.AllocationCode.ToLower().Contains(filter) ||
                (x.PerformerName != null && x.PerformerName.ToLower().Contains(filter)));
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

    public async Task<MaterialAllocationDto> CreateAsync(CreateMaterialAllocationDto input)
    {
        var allocationCode = $"PB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var entity = new MaterialAllocation(
            GuidGenerator.Create(),
            allocationCode,
            input.InventoryItemId,
            input.DepartmentId,
            CurrentUser.Id ?? Guid.Empty,
            input.AllocatedQuantity,
            input.PerformerName,
            input.Note);

        await _repository.InsertAsync(entity);
        return ObjectMapper.Map<MaterialAllocation, MaterialAllocationDto>(entity);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id);
    }
}
