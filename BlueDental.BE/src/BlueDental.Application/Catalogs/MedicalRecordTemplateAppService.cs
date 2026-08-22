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
public class MedicalRecordTemplateAppService : ApplicationService, IMedicalRecordTemplateAppService
{
    private readonly IRepository<MedicalRecordTemplate, Guid> _repository;

    public MedicalRecordTemplateAppService(IRepository<MedicalRecordTemplate, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<MedicalRecordTemplateDto>> GetListAsync(GetMedicalRecordTemplateListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<MedicalRecordTemplateDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<MedicalRecordTemplate>, System.Collections.Generic.List<MedicalRecordTemplateDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<MedicalRecordTemplateDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<MedicalRecordTemplate, MedicalRecordTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<MedicalRecordTemplateDto> CreateAsync(CreateMedicalRecordTemplateDto input)
    {
        var entity = new MedicalRecordTemplate(GuidGenerator.Create(), input.Name, input.Content, input.Description, input.SortOrder);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<MedicalRecordTemplate, MedicalRecordTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<MedicalRecordTemplateDto> UpdateAsync(Guid id, UpdateMedicalRecordTemplateDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Content, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<MedicalRecordTemplate, MedicalRecordTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
