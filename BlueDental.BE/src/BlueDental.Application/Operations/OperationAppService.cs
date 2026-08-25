using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Operations;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class OperationAppService(
    IRepository<OperationCategory, Guid> categoryRepo,
    IRepository<OperationArticle, Guid> articleRepo) : ApplicationService, IOperationAppService
{
    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<OperationCategoryDto>> GetCategoryListAsync(GetOperationListInput input)
    {
        var query = await categoryRepo.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.Department))
            query = query.Where(c => c.Department == input.Department);
        if (!string.IsNullOrWhiteSpace(input.SubTab))
            query = query.Where(c => c.SubTab == input.SubTab);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(c => c.Name.Contains(input.Filter!));

        var totalCount = query.Count();
        var items = query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
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
        var entity = new OperationCategory(GuidGenerator.Create(), input.Name, input.Department, input.SubTab, input.SortOrder);
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
        entity.Update(input.Name, input.SortOrder);
        await categoryRepo.UpdateAsync(entity);
        return new OperationCategoryDto
        {
            Id = entity.Id, Name = entity.Name, Department = entity.Department,
            SubTab = entity.SubTab, SortOrder = entity.SortOrder, CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteCategoryAsync(Guid id) => await categoryRepo.DeleteAsync(id);

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<OperationArticleDto>> GetArticleListAsync(GetOperationListInput input)
    {
        var query = await articleRepo.GetQueryableAsync();

        if (!string.IsNullOrWhiteSpace(input.Department))
            query = query.Where(a => a.Department == input.Department);
        if (!string.IsNullOrWhiteSpace(input.SubTab))
            query = query.Where(a => a.SubTab == input.SubTab);
        if (input.CategoryId.HasValue)
            query = query.Where(a => a.CategoryId == input.CategoryId.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(a => a.Title.Contains(input.Filter!));

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
        var entity = new OperationArticle(GuidGenerator.Create(), input.Title, input.CategoryId, input.Department, input.SubTab, input.Content);
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
    public async Task DeleteArticleAsync(Guid id) => await articleRepo.DeleteAsync(id);
}
