using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

/// <summary>
/// Mẫu phiếu (F-93) — the /labo tab that keeps the branch's extra field lists
/// for the Phiếu yêu cầu. A catalog like Vật liệu &amp; loại phục hình, so it
/// takes the same permissions.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboFormTemplateAppService : BlueDentalAppService, ILaboFormTemplateAppService
{
    private readonly IRepository<LaboFormTemplate, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;

    public LaboFormTemplateAppService(
        IRepository<LaboFormTemplate, Guid> repository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboFormTemplateDto>> GetListAsync(GetLaboFormTemplateListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();
        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.IsActive.HasValue)
        {
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x => DbText.Unaccent(x.Name.ToLower()).Contains(DbText.Unaccent(term)));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(x => x.LastModificationTime ?? x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<LaboFormTemplateDto>(totalCount, items.Select(ToDto).ToList());
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<LaboFormTemplateDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        return ToDto(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboFormTemplateDto> CreateAsync(SaveLaboFormTemplateDto input)
    {
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            _branchResolver.GetRequiredClinicBranchId());
        await EnsureNameFreeAsync(clinicBranchId, input.Name, exceptId: null);

        var entity = LaboFormTemplate.Create(
            GuidGenerator.Create(), clinicBranchId, input.Name, input.Description, FieldsOf(input));
        entity.SetActive(input.IsActive ?? true);

        await _repository.InsertAsync(entity, autoSave: true);
        return ToDto(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboFormTemplateDto> UpdateAsync(Guid id, SaveLaboFormTemplateDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await EnsureNameFreeAsync(entity.ClinicBranchId, input.Name, entity.Id);

        entity.Update(input.Name, input.Description, FieldsOf(input));
        if (input.IsActive.HasValue) entity.SetActive(input.IsActive.Value);

        await _repository.UpdateAsync(entity, autoSave: true);
        return ToDto(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboFormTemplateDto> SetActiveAsync(Guid id, SetLaboFormTemplateActiveDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        entity.SetActive(input.IsActive);

        await _repository.UpdateAsync(entity, autoSave: true);
        return ToDto(entity);
    }

    /// <summary>Soft delete: orders that copied the template keep their copy.</summary>
    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await _repository.DeleteAsync(entity, autoSave: true);
    }

    private static List<LaboFormField> FieldsOf(SaveLaboFormTemplateDto input) =>
        (input.Fields ?? [])
            .Select(f => LaboFormField.Create(f.Key, f.Label, f.Type, f.Required, f.Options))
            .ToList();

    /// <summary>One name per branch among live templates, ignoring case and outer spaces.</summary>
    private async Task EnsureNameFreeAsync(Guid clinicBranchId, string? name, Guid? exceptId)
    {
        var wanted = name?.Trim().ToLower();
        if (string.IsNullOrEmpty(wanted))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormTemplateNameRequired);
        }

        var query = await _repository.GetQueryableAsync();
        var taken = await AsyncExecuter.AnyAsync(query.Where(x =>
            x.ClinicBranchId == clinicBranchId && x.Id != exceptId && x.Name.ToLower() == wanted));
        if (taken)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormTemplateNameTaken)
                .WithData("name", name!.Trim());
        }
    }

    private static LaboFormTemplateDto ToDto(LaboFormTemplate entity) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Name = entity.Name,
        Description = entity.Description,
        IsActive = entity.IsActive,
        Version = entity.Version,
        Fields = entity.Fields.Select(f => new LaboFormFieldDto
        {
            Key = f.Key,
            Label = f.Label,
            Type = f.Type,
            Required = f.Required,
            Options = f.Options.ToList(),
        }).ToList(),
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId,
    };
}
