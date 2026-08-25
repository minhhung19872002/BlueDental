using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

/// <summary>
/// Nhóm danh mục — reference: <c>/api/v1/taxonomy/?group=...</c>.
/// </summary>
public interface ITaxonomyAppService : IApplicationService
{
    Task<PagedResultDto<TaxonomyDto>> GetListAsync(GetTaxonomyListInput input);
    Task<TaxonomyDto> GetAsync(Guid id);
    Task<TaxonomyDto> CreateAsync(CreateTaxonomyDto input);
    Task<TaxonomyDto> UpdateAsync(Guid id, UpdateTaxonomyDto input);
    Task DeleteAsync(Guid id);

    /// <summary>Applies a whole new order in one call.</summary>
    Task ReorderAsync(ReorderTaxonomyDto input);
}

/// <summary>
/// Mục danh mục — reference: the per-catalog list endpoints
/// (<c>/care-service/list</c>, <c>/diagnosis/list</c>, <c>/medicine/list</c>, ...).
/// </summary>
public interface ICatalogEntryAppService : IApplicationService
{
    Task<PagedResultDto<CatalogEntryDto>> GetListAsync(GetCatalogEntryListInput input);
    Task<CatalogEntryDto> GetAsync(Guid id);
    Task<CatalogEntryDto> CreateAsync(CreateCatalogEntryDto input);
    Task<CatalogEntryDto> UpdateAsync(Guid id, UpdateCatalogEntryDto input);
    Task DeleteAsync(Guid id);

    /// <summary>Applies a whole new order in one call.</summary>
    Task ReorderAsync(ReorderCatalogEntryDto input);
}
