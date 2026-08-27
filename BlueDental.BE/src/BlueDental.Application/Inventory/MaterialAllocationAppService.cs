using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
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
    public async Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(
        GetMaterialAllocationListInput input)
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
        // A voucher matches on the materials it carries as well as on its own
        // fields, because "Vật tư" is a column the reader can see.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            queryable = queryable.Where(x =>
                x.AllocationCode.ToLower().Contains(term) ||
                (x.PerformerName != null && x.PerformerName.ToLower().Contains(term)) ||
                (x.Note != null && x.Note.ToLower().Contains(term)) ||
                x.Items.Any(item => item.Name.ToLower().Contains(term)));
        }

        var totalCount = queryable.Count();
        var items = queryable
            .OrderByDescending(x => x.AllocationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<MaterialAllocationDto>(totalCount, await ToDtosAsync(items));
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<MaterialAllocationDto> CreateAsync(CreateMaterialAllocationDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();

        var department = await _departmentRepository.FindAsync(input.DepartmentId)
            ?? throw new EntityNotFoundException(typeof(Department), input.DepartmentId);

        if (department.BranchId != branchId)
        {
            throw new EntityNotFoundException(typeof(Department), input.DepartmentId);
        }

        var allocation = new MaterialAllocation(
            GuidGenerator.Create(),
            await NextCodeAsync(branchId),
            input.DepartmentId,
            branchId,
            input.PerformerName ?? CurrentUser.Name ?? CurrentUser.UserName,
            input.Note);

        foreach (var line in input.Items)
        {
            var item = await _inventoryItemRepository.FindAsync(line.InventoryItemId)
                ?? throw new EntityNotFoundException(typeof(InventoryItem), line.InventoryItemId);

            if (item.BranchId != branchId)
            {
                throw new EntityNotFoundException(typeof(InventoryItem), line.InventoryItemId);
            }

            // Issuing material takes it off the clinic's shelf. ConsumeStock
            // refuses to take more than is there, which is the rule the
            // reference states on its own form: "Số lượng phân bổ tối đa dựa
            // trên số lượng còn lại chưa phân bổ của vật tư."
            item.ConsumeStock(line.Quantity);
            await _inventoryItemRepository.UpdateAsync(item);

            allocation.AddItem(
                GuidGenerator.Create(),
                item.Id,
                item.Name,
                line.Quantity);
        }

        await _repository.InsertAsync(allocation, autoSave: true);
        return (await ToDtosAsync([allocation]))[0];
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<MaterialAllocationDto> ConfirmRemainingAsync(
        Guid id,
        ConfirmAllocationRemainingDto input)
    {
        var allocation = await GetInBranchAsync(id);
        allocation.ConfirmRemaining(input.InventoryItemId, input.Remaining);
        await _repository.UpdateAsync(allocation, autoSave: true);

        return (await ToDtosAsync([allocation]))[0];
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var allocation = await GetInBranchAsync(id);

        // Cancelling a voucher puts the materials back on the shelf. Without
        // this, deleting one would quietly destroy the stock it took.
        foreach (var line in allocation.Items)
        {
            var item = await _inventoryItemRepository.FindAsync(line.InventoryItemId);
            if (item is null)
            {
                continue;
            }

            item.AddStock(line.Quantity);
            await _inventoryItemRepository.UpdateAsync(item);
        }

        await _repository.DeleteAsync(allocation);
    }

    /// <summary>
    /// The reference numbers its vouchers PB + the date + a counter that starts
    /// again each day — PB202608270001.
    /// </summary>
    private async Task<string> NextCodeAsync(Guid branchId)
    {
        var today = Clock.Now.Date;
        var prefix = $"PB{today:yyyyMMdd}";

        var queryable = await _repository.GetQueryableAsync();
        var todayCount = queryable.Count(x =>
            x.BranchId == branchId && x.AllocationCode.StartsWith(prefix));

        return $"{prefix}{todayCount + 1:D4}";
    }

    private async Task<MaterialAllocation> GetInBranchAsync(Guid id)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var allocation = await _repository.GetAsync(id);

        if (allocation.BranchId != branchId)
        {
            throw new EntityNotFoundException(typeof(MaterialAllocation), id);
        }

        return allocation;
    }

    /// <summary>
    /// Maps by hand: the department name lives on another aggregate, and the
    /// lines carry the name they were issued under rather than the material's
    /// name today.
    /// </summary>
    private async Task<List<MaterialAllocationDto>> ToDtosAsync(List<MaterialAllocation> items)
    {
        var departmentIds = items.Select(x => x.DepartmentId).Distinct().ToList();

        var departments = departmentIds.Count == 0
            ? []
            : (await _departmentRepository.GetQueryableAsync())
                .Where(x => departmentIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Name })
                .ToList()
                .ToDictionary(x => x.Id, x => x.Name);

        return items.Select(allocation => new MaterialAllocationDto
        {
            Id = allocation.Id,
            AllocationCode = allocation.AllocationCode,
            DepartmentId = allocation.DepartmentId,
            DepartmentName = departments.GetValueOrDefault(allocation.DepartmentId),
            PerformerName = allocation.PerformerName,
            Note = allocation.Note,
            AllocationTime = allocation.AllocationTime,
            CreationTime = allocation.CreationTime,
            Items = allocation.Items
                .Select(line => new MaterialAllocationItemDto
                {
                    InventoryItemId = line.InventoryItemId,
                    Name = line.Name,
                    Quantity = line.Quantity,
                    ConfirmedQuantity = line.ConfirmedQuantity,
                })
                .ToList(),
        }).ToList();
    }
}
