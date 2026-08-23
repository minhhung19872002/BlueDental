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
public class DentalProcedureAppService : ApplicationService, IDentalProcedureAppService
{
    private readonly IRepository<DentalProcedure, Guid> _repository;

    public DentalProcedureAppService(IRepository<DentalProcedure, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<DentalProcedureDto>> GetListAsync(GetDentalProcedureListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(p => p.Name.Contains(input.Filter) || p.Code.Contains(input.Filter));
        if (input.Category.HasValue) query = query.Where(p => p.Category == input.Category.Value);
        if (input.IsActive.HasValue) query = query.Where(p => p.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<DentalProcedureDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<DentalProcedure>, System.Collections.Generic.List<DentalProcedureDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<DentalProcedureDto> GetAsync(Guid id)
    {
        var proc = await _repository.GetAsync(id);
        return ObjectMapper.Map<DentalProcedure, DentalProcedureDto>(proc);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<DentalProcedureDto> CreateAsync(CreateDentalProcedureDto input)
    {
        var proc = new DentalProcedure(
            GuidGenerator.Create(),
            input.Code,
            input.Name,
            input.Category,
            input.BasePrice,
            input.EstimatedDurationMinutes,
            input.Description);

        await _repository.InsertAsync(proc, autoSave: true);
        return ObjectMapper.Map<DentalProcedure, DentalProcedureDto>(proc);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<DentalProcedureDto> UpdateAsync(Guid id, UpdateDentalProcedureDto input)
    {
        var proc = await _repository.GetAsync(id);
        proc.Update(input.Name, proc.Code, input.Category, input.EstimatedDurationMinutes, input.BasePrice, input.Description);
        await _repository.UpdateAsync(proc, autoSave: true);
        return ObjectMapper.Map<DentalProcedure, DentalProcedureDto>(proc);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var proc = await _repository.GetAsync(id);
        proc.Deactivate();
        await _repository.UpdateAsync(proc, autoSave: true);
    }
}
