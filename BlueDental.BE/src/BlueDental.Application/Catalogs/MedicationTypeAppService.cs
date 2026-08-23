using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class MedicationTypeAppService : ApplicationService, IMedicationTypeAppService
{
    private readonly IRepository<MedicationType, Guid> _repository;

    public MedicationTypeAppService(IRepository<MedicationType, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<MedicationTypeDto>> GetListAsync(GetMedicationTypeListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<MedicationTypeDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<MedicationType>, System.Collections.Generic.List<MedicationTypeDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<MedicationTypeDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<MedicationType, MedicationTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<MedicationTypeDto> CreateAsync(CreateMedicationTypeDto input)
    {
        var entity = new MedicationType(GuidGenerator.Create(), input.Name, input.Description, input.SortOrder);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<MedicationType, MedicationTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<MedicationTypeDto> UpdateAsync(Guid id, UpdateMedicationTypeDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<MedicationType, MedicationTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
