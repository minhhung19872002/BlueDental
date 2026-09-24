using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

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

    /// <summary>One drag is one call carrying the whole order.</summary>
    [HttpPost("reorder")]
    public Task ReorderAsync([FromBody] ReorderTaxonomyDto input) => service.ReorderAsync(input);
}

/// <summary>Mục danh mục.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/catalog-entries")]
public sealed class CatalogEntryController(
    ICatalogEntryAppService service,
    ICatalogImportAppService importService) : BlueDentalController
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

    /// <summary>One drag is one call carrying the whole order.</summary>
    [HttpPost("reorder")]
    public Task ReorderAsync([FromBody] ReorderCatalogEntryDto input) => service.ReorderAsync(input);

    /// <summary>Empty workbook with the headers the importer expects for one catalog.</summary>
    [HttpGet("import-template")]
    public async Task<IActionResult> GetImportTemplateAsync([FromQuery] string group) =>
        Excel(await importService.GetTemplateAsync(group), $"mau-nhap-{group.Replace('_', '-')}");

    /// <summary>
    /// One multipart request: the file plus the branch, the catalog and whether
    /// this is the preview (dryRun) or the real write.
    /// </summary>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public Task<CatalogImportResultDto> ImportAsync(
        [FromForm] IFormFile file,
        [FromForm] string group,
        [FromForm] Guid? clinicBranchId,
        [FromForm] bool dryRun) =>
        importService.ImportAsync(ToImportDto(file, group, clinicBranchId, dryRun));

    /// <summary>The same file back, with a "Lỗi" column on every sheet.</summary>
    [HttpPost("import-errors")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> GetImportErrorFileAsync(
        [FromForm] IFormFile file,
        [FromForm] string group,
        [FromForm] Guid? clinicBranchId) =>
        Excel(
            await importService.GetErrorFileAsync(ToImportDto(file, group, clinicBranchId, dryRun: true)),
            $"loi-nhap-{group.Replace('_', '-')}");

    private static ImportCatalogEntriesDto ToImportDto(
        IFormFile file, string group, Guid? clinicBranchId, bool dryRun) => new()
    {
        File = new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType, file.Length),
        Group = group,
        ClinicBranchId = clinicBranchId,
        DryRun = dryRun
    };
}
