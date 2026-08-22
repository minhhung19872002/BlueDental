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
public class LaboSupplierAppService : ApplicationService, ILaboSupplierAppService
{
    private readonly IRepository<LaboSupplier, Guid> _repository;

    public LaboSupplierAppService(IRepository<LaboSupplier, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboSupplierDto>> GetListAsync(GetLaboSupplierListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter) || (x.Phone != null && x.Phone.Contains(input.Filter)));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<LaboSupplierDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<LaboSupplier>, System.Collections.Generic.List<LaboSupplierDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<LaboSupplierDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboSupplierDto> CreateAsync(CreateLaboSupplierDto input)
    {
        var entity = new LaboSupplier(GuidGenerator.Create(), input.Name, input.Phone, input.Email, input.Address);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboSupplierDto> UpdateAsync(Guid id, UpdateLaboSupplierDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Phone, input.Email, input.Address);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
