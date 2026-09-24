using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

/// <summary>
/// Excel import for Danh mục — BlueDental's own feature (the reference offers
/// none), asked for by the BA to load a clinic's catalogs in bulk.
/// </summary>
public interface ICatalogImportAppService : IApplicationService
{
    /// <summary>An empty workbook with the headers the importer expects for that catalog.</summary>
    Task<byte[]> GetTemplateAsync(string group);

    /// <summary>
    /// Validates the whole file and, unless <see cref="ImportCatalogEntriesDto.DryRun"/> is
    /// set, writes every row in one unit of work. A single bad row rejects the file.
    /// </summary>
    Task<CatalogImportResultDto> ImportAsync(ImportCatalogEntriesDto input);

    /// <summary>The uploaded file with a "Lỗi" column added to every sheet, for fixing offline.</summary>
    Task<byte[]> GetErrorFileAsync(ImportCatalogEntriesDto input);
}
