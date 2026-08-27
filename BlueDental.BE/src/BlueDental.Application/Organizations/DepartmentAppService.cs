using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Organizations;

[Authorize(BlueDentalPermissions.Organizations.Default)]
public class DepartmentAppService : ApplicationService, IDepartmentAppService
{
    private readonly IRepository<Department, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public DepartmentAppService(
        IRepository<Department, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Organizations.View)]
    public async Task<PagedResultDto<DepartmentDto>> GetListAsync(GetDepartmentListInput input)
    {
        // Departments belong to a branch. This used to read them all, so every
        // branch saw every other branch's departments — and created its own
        // with no branch at all.
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var queryable = await _repository.GetQueryableAsync();
        queryable = queryable.Where(x => x.BranchId == branchId);

        // Every word typed has to appear in the name, in any order, whatever
        // the casing — the same rule the rest of the app searches by.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            queryable = queryable.Where(x => x.Name.ToLower().Contains(term));
        }

        var totalCount = queryable.Count();
        var items = queryable
            // The reference orders this list by "order"; the name only breaks
            // ties so the panel cannot flicker between equal positions.
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<DepartmentDto>(
            totalCount,
            ObjectMapper.Map<List<Department>, List<DepartmentDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Organizations.Create)]
    public async Task<DepartmentDto> CreateAsync(CreateDepartmentDto input)
    {
        var entity = new Department(
            GuidGenerator.Create(),
            input.Name,
            input.Description,
            _branchResolver.GetRequiredClinicBranchId(),
            input.SortOrder);

        await _repository.InsertAsync(entity);
        return ObjectMapper.Map<Department, DepartmentDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentDto input)
    {
        var entity = await GetInBranchAsync(id);
        entity.Update(input.Name, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity);
        return ObjectMapper.Map<Department, DepartmentDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Organizations.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(await GetInBranchAsync(id));
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task ReorderAsync(ReorderDepartmentsDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var queryable = await _repository.GetQueryableAsync();
        var byId = queryable
            .Where(x => x.BranchId == branchId && input.Ids.Contains(x.Id))
            .ToDictionary(x => x.Id);

        // One call carries the whole order, so a drag is one round trip rather
        // than one per row that moved.
        for (var position = 0; position < input.Ids.Count; position++)
        {
            if (byId.TryGetValue(input.Ids[position], out var department))
            {
                department.MoveTo(position);
                await _repository.UpdateAsync(department);
            }
        }
    }

    /// <summary>
    /// Reads one department, refusing ids that belong to another branch —
    /// GetAsync alone would happily return and then edit somebody else's.
    /// </summary>
    private async Task<Department> GetInBranchAsync(Guid id)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var entity = await _repository.GetAsync(id);

        if (entity.BranchId != branchId)
        {
            throw new Volo.Abp.Domain.Entities.EntityNotFoundException(typeof(Department), id);
        }

        return entity;
    }
}
