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
public class PatientTagAppService : ApplicationService, IPatientTagAppService
{
    private readonly IRepository<PatientTag, Guid> _repository;

    public PatientTagAppService(IRepository<PatientTag, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<PatientTagDto>> GetListAsync(GetPatientTagListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<PatientTagDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<PatientTag>, System.Collections.Generic.List<PatientTagDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PatientTagDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<PatientTagDto> CreateAsync(CreatePatientTagDto input)
    {
        var entity = new PatientTag(GuidGenerator.Create(), input.Name, input.Color, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PatientTagDto> UpdateAsync(Guid id, UpdatePatientTagDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Color, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
