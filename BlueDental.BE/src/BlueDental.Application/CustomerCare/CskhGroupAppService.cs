using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare;

[Authorize(BlueDentalPermissions.CustomerCare.Default)]
public class CskhGroupAppService : ApplicationService, ICskhGroupAppService
{
    private readonly IRepository<CskhGroup, Guid> _repository;

    public CskhGroupAppService(IRepository<CskhGroup, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<PagedResultDto<CskhGroupDto>> GetListAsync(GetCskhGroupListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<CskhGroupDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<CskhGroup>, System.Collections.Generic.List<CskhGroupDto>>(items));
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CskhGroupDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<CskhGroup, CskhGroupDto>(entity);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Create)]
    public async Task<CskhGroupDto> CreateAsync(CreateCskhGroupDto input)
    {
        var entity = new CskhGroup(GuidGenerator.Create(), input.Name, input.Criteria, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<CskhGroup, CskhGroupDto>(entity);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CskhGroupDto> UpdateAsync(Guid id, UpdateCskhGroupDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Criteria, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<CskhGroup, CskhGroupDto>(entity);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
