using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

/// <summary>
/// Thẻ hồ sơ — the flat "Danh mục / Thẻ hồ sơ" table.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class PatientTagAppService : ApplicationService, IPatientTagAppService
{
    private readonly IRepository<PatientTag, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;

    public PatientTagAppService(
        IRepository<PatientTag, Guid> repository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<PatientTagDto>> GetListAsync(GetPatientTagListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        // One box searches every column the reference shows, and the note
        // behind them.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(term) ||
                x.Color.ToLower().Contains(term) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        if (input.IsActive.HasValue)
        {
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        }

        var totalCount = query.Count();
        var items = query
            // Same rule as the catalogs: the newest tag is the one just added,
            // so it belongs at the top rather than wherever the alphabet puts it.
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientTagDto>(
            totalCount,
            ObjectMapper.Map<List<PatientTag>, List<PatientTagDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PatientTagDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<PatientTagDto> CreateAsync(CreatePatientTagDto input)
    {
        // The header can switch branches, so the record lands in the one the
        // caller named — checked against what this account may write to.
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            _branchResolver.GetRequiredClinicBranchId());

        var entity = PatientTag.Create(
            GuidGenerator.Create(),
            clinicBranchId,
            input.Name,
            input.Color,
            input.Description);

        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PatientTagDto> UpdateAsync(Guid id, UpdatePatientTagDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        entity.Update(input.Name, input.Color, input.Description);

        if (input.IsActive)
        {
            entity.Activate();
        }
        else
        {
            entity.Deactivate();
        }

        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<PatientTag, PatientTagDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
