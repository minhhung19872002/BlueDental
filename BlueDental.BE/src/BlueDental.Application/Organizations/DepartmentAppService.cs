using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Organizations;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class DepartmentAppService : ApplicationService, IDepartmentAppService
{
    private readonly IRepository<Department, Guid> _repository;

    public DepartmentAppService(IRepository<Department, Guid> repository)
    {
        _repository = repository;
    }

    public async Task<PagedResultDto<DepartmentDto>> GetListAsync(GetDepartmentListInput input)
    {
        var queryable = await _repository.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.ToLowerInvariant();
            queryable = queryable.Where(x => x.Name.ToLower().Contains(filter));
        }

        var totalCount = queryable.Count();
        var items = queryable
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<DepartmentDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Department>, System.Collections.Generic.List<DepartmentDto>>(items));
    }

    public async Task<DepartmentDto> CreateAsync(CreateDepartmentDto input)
    {
        var entity = new Department(
            GuidGenerator.Create(),
            input.Name,
            input.Description);

        await _repository.InsertAsync(entity);
        return ObjectMapper.Map<Department, DepartmentDto>(entity);
    }

    public async Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description);
        await _repository.UpdateAsync(entity);
        return ObjectMapper.Map<Department, DepartmentDto>(entity);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id);
    }
}
