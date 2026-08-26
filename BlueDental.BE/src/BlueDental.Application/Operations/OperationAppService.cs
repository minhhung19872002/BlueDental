using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Operations;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class OperationAppService(
    IRepository<OperationCategory, Guid> categoryRepo,
    IRepository<OperationArticle, Guid> articleRepo,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IOperationAppService
{
    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<OperationCategoryDto>> GetCategoryListAsync(GetOperationListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await categoryRepo.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(c => branchFilter.Contains(c.ClinicBranchId));
        if (!string.IsNullOrWhiteSpace(input.Department))
            query = query.Where(c => c.Department == input.Department);
        if (!string.IsNullOrWhiteSpace(input.SubTab))
            query = query.Where(c => c.SubTab == input.SubTab);
        foreach (var term in SearchTerms.From(input.Filter))
            query = query.Where(c => c.Name.ToLower().Contains(term));

        var totalCount = query.Count();
        var items = query
            .OrderBy(c => c.SortOrder)
            // Newest first among equal priorities, so a category just added is
            // at the top of the panel the moment it is saved.
            .ThenByDescending(c => c.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<OperationCategoryDto>(totalCount,
            items.Select(c => new OperationCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Department = c.Department,
                SubTab = c.SubTab,
                SortOrder = c.SortOrder,
                CreationTime = c.CreationTime,
            }).ToList());
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<OperationCategoryDto> CreateCategoryAsync(CreateOperationCategoryDto input)
    {
        var clinicBranchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            branchResolver.GetRequiredClinicBranchId());

        var entity = new OperationCategory(
            GuidGenerator.Create(), clinicBranchId, input.Name,
            input.Department, input.SubTab, input.SortOrder);
        await categoryRepo.InsertAsync(entity);
        return new OperationCategoryDto
        {
            Id = entity.Id, Name = entity.Name, Department = entity.Department,
            SubTab = entity.SubTab, SortOrder = entity.SortOrder, CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<OperationCategoryDto> UpdateCategoryAsync(Guid id, UpdateOperationCategoryDto input)
    {
        var entity = await categoryRepo.GetAsync(id);
        await branchAccess.CheckAsync(entity.ClinicBranchId);
        entity.Update(input.Name, input.SortOrder);
        await categoryRepo.UpdateAsync(entity);
        return new OperationCategoryDto
        {
            Id = entity.Id, Name = entity.Name, Department = entity.Department,
            SubTab = entity.SubTab, SortOrder = entity.SortOrder, CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteCategoryAsync(Guid id)
    {
        var entity = await categoryRepo.GetAsync(id);
        await branchAccess.CheckAsync(entity.ClinicBranchId);

        // An article belongs to exactly one category and is reachable only
        // through it, so leaving them behind would strand rows nothing can
        // list, edit or delete — and the screen would go on counting them.
        var orphans = await articleRepo.GetListAsync(a => a.CategoryId == id);
        if (orphans.Count > 0)
        {
            await articleRepo.DeleteManyAsync(orphans, autoSave: true);
        }

        await categoryRepo.DeleteAsync(id);
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<OperationArticleDto>> GetArticleListAsync(GetOperationListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await articleRepo.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(a => branchFilter.Contains(a.ClinicBranchId));
        if (!string.IsNullOrWhiteSpace(input.Department))
            query = query.Where(a => a.Department == input.Department);
        if (!string.IsNullOrWhiteSpace(input.SubTab))
            query = query.Where(a => a.SubTab == input.SubTab);
        if (input.CategoryId.HasValue)
            query = query.Where(a => a.CategoryId == input.CategoryId.Value);
        foreach (var term in SearchTerms.From(input.Filter))
            query = query.Where(a => a.Title.ToLower().Contains(term));

        var totalCount = query.Count();
        var items = query.OrderByDescending(a => a.LastModificationTime ?? a.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<OperationArticleDto>(totalCount,
            items.Select(a => new OperationArticleDto
            {
                Id = a.Id, Title = a.Title, Content = a.Content, CategoryId = a.CategoryId,
                Department = a.Department, SubTab = a.SubTab,
                CreationTime = a.CreationTime, LastModificationTime = a.LastModificationTime,
            }).ToList());
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<OperationArticleDto> CreateArticleAsync(CreateOperationArticleDto input)
    {
        var clinicBranchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            branchResolver.GetRequiredClinicBranchId());

        var entity = new OperationArticle(
            GuidGenerator.Create(), clinicBranchId, input.Title, input.CategoryId,
            input.Department, input.SubTab, input.Content);
        await articleRepo.InsertAsync(entity);
        return new OperationArticleDto
        {
            Id = entity.Id, Title = entity.Title, Content = entity.Content, CategoryId = entity.CategoryId,
            Department = entity.Department, SubTab = entity.SubTab, CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<OperationArticleDto> UpdateArticleAsync(Guid id, UpdateOperationArticleDto input)
    {
        var entity = await articleRepo.GetAsync(id);
        await branchAccess.CheckAsync(entity.ClinicBranchId);
        entity.Update(input.Title, input.Content);
        await articleRepo.UpdateAsync(entity);
        return new OperationArticleDto
        {
            Id = entity.Id, Title = entity.Title, Content = entity.Content, CategoryId = entity.CategoryId,
            Department = entity.Department, SubTab = entity.SubTab,
            CreationTime = entity.CreationTime, LastModificationTime = entity.LastModificationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteArticleAsync(Guid id)
    {
        var entity = await articleRepo.GetAsync(id);
        await branchAccess.CheckAsync(entity.ClinicBranchId);
        await articleRepo.DeleteAsync(id);
    }
}
