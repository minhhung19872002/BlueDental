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
public class ConsultingDataAppService : ApplicationService, IConsultingDataAppService
{
    private readonly IRepository<ConsultingData, Guid> _repository;

    public ConsultingDataAppService(IRepository<ConsultingData, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<ConsultingDataDto>> GetListAsync(GetConsultingDataListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<ConsultingDataDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<ConsultingData>, System.Collections.Generic.List<ConsultingDataDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<ConsultingDataDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<ConsultingData, ConsultingDataDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<ConsultingDataDto> CreateAsync(CreateConsultingDataDto input)
    {
        var entity = new ConsultingData(GuidGenerator.Create(), input.Name, input.Description, input.SortOrder);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<ConsultingData, ConsultingDataDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<ConsultingDataDto> UpdateAsync(Guid id, UpdateConsultingDataDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description, input.SortOrder);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<ConsultingData, ConsultingDataDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
