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
using Volo.Abp.Identity;

namespace BlueDental.Operations;

/// <summary>
/// Trang chủ / Quy trình của từng khối.
/// </summary>
[Authorize]
public class OperationsArticleAppService : ApplicationService, IOperationsArticleAppService
{
    private readonly IRepository<OperationsArticle, Guid> _repository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public OperationsArticleAppService(
        IRepository<OperationsArticle, Guid> repository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    public async Task<PagedResultDto<OperationsArticleDto>> GetListAsync(
        GetOperationsArticleListInput input)
    {
        if (input.Department.HasValue && input.Section.HasValue)
        {
            await CheckAsync(input.Department.Value, input.Section.Value, BlueDentalAbilities.Actions.Read);
        }

        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.Department.HasValue)
            query = query.Where(x => x.Department == input.Department.Value);
        if (input.Section.HasValue)
            query = query.Where(x => x.Section == input.Section.Value);
        if (input.IsPublished.HasValue)
            query = query.Where(x => x.IsPublished == input.IsPublished.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Title.Contains(filter));
        }

        var totalCount = query.Count();
        var items = query
            // Pinned first, then by explicit order, then newest.
            .OrderByDescending(x => x.IsPinned)
            .ThenBy(x => x.SortOrder)
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var authors = await GetAuthorNamesAsync(items);
        return new PagedResultDto<OperationsArticleDto>(
            totalCount,
            items.Select(x => MapToDto(x, authors)).ToList());
    }

    public async Task<OperationsArticleDto> GetAsync(Guid id)
    {
        var article = await LoadAsync(id, BlueDentalAbilities.Actions.Read);
        return MapToDto(article, await GetAuthorNamesAsync([article]));
    }

    public async Task<OperationsArticleDto> CreateAsync(CreateOperationsArticleDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await CheckAsync(input.Department, input.Section, BlueDentalAbilities.Actions.Create);

        var article = OperationsArticle.Draft(
            GuidGenerator.Create(),
            input.ClinicBranchId,
            input.Department,
            input.Section,
            input.Title,
            input.Summary,
            input.Content,
            input.SortOrder);

        await _repository.InsertAsync(article, autoSave: true);
        return MapToDto(article, await GetAuthorNamesAsync([article]));
    }

    public async Task<OperationsArticleDto> UpdateAsync(Guid id, UpdateOperationsArticleDto input)
    {
        var article = await LoadAsync(id, BlueDentalAbilities.Actions.Update);

        article.UpdateContent(input.Title, input.Summary, input.Content);
        article.Reorder(input.SortOrder);
        article.Pin(input.IsPinned);

        await _repository.UpdateAsync(article, autoSave: true);
        return MapToDto(article, await GetAuthorNamesAsync([article]));
    }

    public async Task<OperationsArticleDto> PublishAsync(Guid id)
    {
        var article = await LoadAsync(id, BlueDentalAbilities.Actions.Update);
        article.Publish();
        await _repository.UpdateAsync(article, autoSave: true);
        return MapToDto(article, await GetAuthorNamesAsync([article]));
    }

    public async Task<OperationsArticleDto> UnpublishAsync(Guid id)
    {
        var article = await LoadAsync(id, BlueDentalAbilities.Actions.Update);
        article.Unpublish();
        await _repository.UpdateAsync(article, autoSave: true);
        return MapToDto(article, await GetAuthorNamesAsync([article]));
    }

    public async Task DeleteAsync(Guid id)
    {
        await LoadAsync(id, BlueDentalAbilities.Actions.Delete);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<OperationsArticle> LoadAsync(Guid id, string action)
    {
        var article = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(article.ClinicBranchId);
        await CheckAsync(article.Department, article.Section, action);
        return article;
    }

    /// <summary>Each department+section pair has its own ability subject.</summary>
    private Task CheckAsync(OperationsDepartment department, OperationsSection section, string action) =>
        AuthorizationService.CheckAsync(OperationsAbilities.PermissionFor(department, section, action));

    private async Task<Dictionary<Guid, string>> GetAuthorNamesAsync(
        IReadOnlyCollection<OperationsArticle> articles)
    {
        var ids = articles
            .Where(x => x.CreatorId.HasValue)
            .Select(x => x.CreatorId!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private static OperationsArticleDto MapToDto(
        OperationsArticle entity,
        IReadOnlyDictionary<Guid, string> authors) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Department = entity.Department,
        Section = entity.Section,
        Title = entity.Title,
        Summary = entity.Summary,
        Content = entity.Content,
        SortOrder = entity.SortOrder,
        IsPublished = entity.IsPublished,
        IsPinned = entity.IsPinned,
        PublishedAt = entity.PublishedAt,
        AuthorName = entity.CreatorId.HasValue && authors.TryGetValue(entity.CreatorId.Value, out var author)
            ? author
            : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
