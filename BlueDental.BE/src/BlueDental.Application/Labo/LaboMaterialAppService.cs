using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboMaterialAppService : ApplicationService, ILaboMaterialAppService
{
    private readonly IRepository<LaboMaterial, Guid> _repository;

    public LaboMaterialAppService(IRepository<LaboMaterial, Guid> repository)
    {
        _repository = repository;
    }

    public async Task<PagedResultDto<LaboMaterialDto>> GetListAsync(GetLaboMaterialListInput input)
    {
        var queryable = await _repository.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.ToLowerInvariant();
            queryable = queryable.Where(x =>
                x.Name.ToLower().Contains(filter) ||
                (x.Category != null && x.Category.ToLower().Contains(filter)));
        }

        var totalCount = queryable.Count();
        var items = queryable
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<LaboMaterialDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<LaboMaterial>, System.Collections.Generic.List<LaboMaterialDto>>(items));
    }

    public async Task<LaboMaterialDto> CreateAsync(CreateLaboMaterialDto input)
    {
        var entity = new LaboMaterial(
            GuidGenerator.Create(),
            input.Name,
            input.Category,
            input.Description,
            input.SupplierId);

        await _repository.InsertAsync(entity);
        return ObjectMapper.Map<LaboMaterial, LaboMaterialDto>(entity);
    }

    public async Task<LaboMaterialDto> UpdateAsync(Guid id, UpdateLaboMaterialDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Category, input.Description, input.SupplierId);
        await _repository.UpdateAsync(entity);
        return ObjectMapper.Map<LaboMaterial, LaboMaterialDto>(entity);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id);
    }
}
