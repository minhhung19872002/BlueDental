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
public class PrescriptionTemplateAppService : ApplicationService, IPrescriptionTemplateAppService
{
    private readonly IRepository<PrescriptionTemplate, Guid> _repository;

    public PrescriptionTemplateAppService(IRepository<PrescriptionTemplate, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<PrescriptionTemplateDto>> GetListAsync(GetPrescriptionTemplateListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<PrescriptionTemplateDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<PrescriptionTemplate>, System.Collections.Generic.List<PrescriptionTemplateDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PrescriptionTemplateDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<PrescriptionTemplate, PrescriptionTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<PrescriptionTemplateDto> CreateAsync(CreatePrescriptionTemplateDto input)
    {
        var entity = new PrescriptionTemplate(GuidGenerator.Create(), input.Name, input.Content, input.Description, input.SortOrder);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<PrescriptionTemplate, PrescriptionTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PrescriptionTemplateDto> UpdateAsync(Guid id, UpdatePrescriptionTemplateDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Content, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<PrescriptionTemplate, PrescriptionTemplateDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
