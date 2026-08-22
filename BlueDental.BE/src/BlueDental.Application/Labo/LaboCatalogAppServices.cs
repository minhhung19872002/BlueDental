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
public class LaboBiteTypeAppService : ApplicationService, ILaboBiteTypeAppService
{
    private readonly IRepository<LaboBiteType, Guid> _repository;

    public LaboBiteTypeAppService(IRepository<LaboBiteType, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboBiteTypeDto>> GetListAsync(GetLaboBiteTypeListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<LaboBiteTypeDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<LaboBiteType>, System.Collections.Generic.List<LaboBiteTypeDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboBiteTypeDto> CreateAsync(CreateLaboBiteTypeDto input)
    {
        var entity = new LaboBiteType(GuidGenerator.Create(), input.Name, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboBiteType, LaboBiteTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboBiteTypeDto> UpdateAsync(Guid id, UpdateLaboBiteTypeDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboBiteType, LaboBiteTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboFinishLineAppService : ApplicationService, ILaboFinishLineAppService
{
    private readonly IRepository<LaboFinishLine, Guid> _repository;

    public LaboFinishLineAppService(IRepository<LaboFinishLine, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboFinishLineDto>> GetListAsync(GetLaboFinishLineListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<LaboFinishLineDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<LaboFinishLine>, System.Collections.Generic.List<LaboFinishLineDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboFinishLineDto> CreateAsync(CreateLaboFinishLineDto input)
    {
        var entity = new LaboFinishLine(GuidGenerator.Create(), input.Name, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboFinishLine, LaboFinishLineDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboFinishLineDto> UpdateAsync(Guid id, UpdateLaboFinishLineDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboFinishLine, LaboFinishLineDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboRhythmTypeAppService : ApplicationService, ILaboRhythmTypeAppService
{
    private readonly IRepository<LaboRhythmType, Guid> _repository;

    public LaboRhythmTypeAppService(IRepository<LaboRhythmType, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboRhythmTypeDto>> GetListAsync(GetLaboRhythmTypeListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<LaboRhythmTypeDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<LaboRhythmType>, System.Collections.Generic.List<LaboRhythmTypeDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboRhythmTypeDto> CreateAsync(CreateLaboRhythmTypeDto input)
    {
        var entity = new LaboRhythmType(GuidGenerator.Create(), input.Name, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboRhythmType, LaboRhythmTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboRhythmTypeDto> UpdateAsync(Guid id, UpdateLaboRhythmTypeDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboRhythmType, LaboRhythmTypeDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
