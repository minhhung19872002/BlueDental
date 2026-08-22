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
public class DiagnosisAppService : ApplicationService, IDiagnosisAppService
{
    private readonly IRepository<Diagnosis, Guid> _repository;

    public DiagnosisAppService(IRepository<Diagnosis, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<DiagnosisDto>> GetListAsync(GetDiagnosisListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter) || x.Code.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<DiagnosisDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Diagnosis>, System.Collections.Generic.List<DiagnosisDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<DiagnosisDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<Diagnosis, DiagnosisDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<DiagnosisDto> CreateAsync(CreateDiagnosisDto input)
    {
        var entity = new Diagnosis(GuidGenerator.Create(), input.Code, input.Name, input.Description, input.SortOrder);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<Diagnosis, DiagnosisDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<DiagnosisDto> UpdateAsync(Guid id, UpdateDiagnosisDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<Diagnosis, DiagnosisDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
