using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Auditing;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Organizations;

/// <summary>
/// Only a signed-in user at class level: ABP unions the class and method
/// policies, so a class-level Organizations policy would also close the
/// accessible-branch list that every user needs. Each method names its own.
/// </summary>
[Authorize]
public class ClinicBranchAppService : ApplicationService, IClinicBranchAppService
{
    private readonly IRepository<ClinicBranch, Guid> _repository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public ClinicBranchAppService(
        IRepository<ClinicBranch, Guid> repository,
        BranchAccessChecker branchAccess,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _repository = repository;
        _branchAccess = branchAccess;
        _softDeleteFilter = softDeleteFilter;
    }

    [Authorize(BlueDentalPermissions.Organizations.View)]
    public async Task<PagedResultDto<ClinicBranchDto>> GetListAsync(GetClinicBranchListInput input)
    {
        using var _ = input.IncludeDeleted ? _softDeleteFilter.Disable() : null;

        var query = await _repository.GetQueryableAsync();

        if (input.AccessibleOnly)
        {
            // An empty list means "no limit", so a clinic-wide account still
            // sees every branch.
            var allowed = await _branchAccess.GetAllowedBranchIdsAsync();
            if (allowed.Count > 0)
            {
                query = query.Where(b => allowed.Contains(b.Id));
            }
        }

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            query = query.Where(b =>
                b.Name.Contains(input.Filter) || b.Code.Contains(input.Filter));
        }

        if (input.Status.HasValue)
        {
            query = query.Where(b => b.Status == input.Status.Value);
        }

        var totalCount = query.Count();
        var items = query
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<ClinicBranchDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<ClinicBranch>, System.Collections.Generic.List<ClinicBranchDto>>(items));
    }

    /// <summary>
    /// Every signed-in user needs the list of branches they may switch to,
    /// whether or not they can administer branches. No policy beyond a
    /// signed-in user, and the list is always narrowed to the caller's
    /// allowed branches.
    /// </summary>
    [Authorize]
    public async Task<ListResultDto<ClinicBranchDto>> GetAccessibleAsync()
    {
        var query = await _repository.GetQueryableAsync();

        var allowed = await _branchAccess.GetAllowedBranchIdsAsync();
        if (allowed.Count > 0)
        {
            query = query.Where(b => allowed.Contains(b.Id));
        }

        var items = query.OrderBy(b => b.Name).ToList();
        return new ListResultDto<ClinicBranchDto>(
            ObjectMapper.Map<System.Collections.Generic.List<ClinicBranch>, System.Collections.Generic.List<ClinicBranchDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Organizations.View)]
    public async Task<ClinicBranchDto> GetAsync(Guid id)
    {
        var branch = await _repository.GetAsync(id);
        return ObjectMapper.Map<ClinicBranch, ClinicBranchDto>(branch);
    }

    [Authorize(BlueDentalPermissions.Organizations.Create)]
    public async Task<ClinicBranchDto> CreateAsync(CreateClinicBranchDto input)
    {
        if (await _repository.AnyAsync(b => b.Code == input.Code))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.DuplicateCode);
        }

        if (await _repository.AnyAsync(b => b.Name == input.Name))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.DuplicateName);
        }

        var branch = new ClinicBranch(
            GuidGenerator.Create(),
            input.Code,
            input.Name,
            input.Address,
            input.PhoneNumber,
            input.Email);
        branch.SetContactInfo(input.PhoneNumber, input.Email, input.Address, input.ProvinceId, input.WardId);
        branch.SetSlogan(input.Slogan);
        branch.SetTaxCode(input.TaxCode);
        branch.SetContactPerson(input.ContactPerson);

        await _repository.InsertAsync(branch, autoSave: true);
        return ObjectMapper.Map<ClinicBranch, ClinicBranchDto>(branch);
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task<ClinicBranchDto> UpdateAsync(Guid id, UpdateClinicBranchDto input)
    {
        var branch = await _repository.GetAsync(id);
        branch.SetName(input.Name);
        branch.SetContactInfo(input.PhoneNumber, input.Email, input.Address, input.ProvinceId, input.WardId);
        branch.SetSlogan(input.Slogan);
        branch.SetTaxCode(input.TaxCode);
        branch.SetContactPerson(input.ContactPerson);
        await _repository.UpdateAsync(branch, autoSave: true);
        return ObjectMapper.Map<ClinicBranch, ClinicBranchDto>(branch);
    }

    [Authorize(BlueDentalPermissions.Organizations.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
