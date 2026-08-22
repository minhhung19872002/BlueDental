using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

/// <summary>Nhóm danh mục.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/taxonomies")]
public sealed class TaxonomyController(ITaxonomyAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TaxonomyDto>> GetListAsync([FromQuery] GetTaxonomyListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<TaxonomyDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<TaxonomyDto> CreateAsync([FromBody] CreateTaxonomyDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TaxonomyDto> UpdateAsync(Guid id, [FromBody] UpdateTaxonomyDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Mục danh mục.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/catalog-entries")]
public sealed class CatalogEntryController(ICatalogEntryAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<CatalogEntryDto>> GetListAsync(
        [FromQuery] GetCatalogEntryListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<CatalogEntryDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<CatalogEntryDto> CreateAsync([FromBody] CreateCatalogEntryDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<CatalogEntryDto> UpdateAsync(Guid id, [FromBody] UpdateCatalogEntryDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
