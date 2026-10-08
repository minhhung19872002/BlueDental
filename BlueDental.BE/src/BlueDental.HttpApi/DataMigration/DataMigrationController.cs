using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Content;

namespace BlueDental.DataMigration;

/// <summary>
/// One-time move of a clinic's old system (patients + treatment history).
/// No screen: run from Swagger or curl, preview with <c>dryRun=true</c> first.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/data-migration")]
public sealed class DataMigrationController(IDataMigrationAppService service) : BlueDentalController
{
    /// <summary>BlueDental_Migration.xlsx: the two data sheets, a guide and the branch's catalogs.</summary>
    [HttpGet("template")]
    public async Task<IActionResult> GetTemplateAsync([FromQuery] Guid? clinicBranchId) =>
        Excel(await service.GetTemplateAsync(clinicBranchId), "BlueDental_Migration");

    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public Task<DataMigrationResultDto> ImportAsync(
        [FromForm] IFormFile file,
        [FromForm] Guid? clinicBranchId,
        [FromForm] bool dryRun) =>
        service.ImportAsync(ToImportDto(file, clinicBranchId, dryRun));

    /// <summary>The same file back, with a "Lỗi" column on both data sheets.</summary>
    [HttpPost("import-errors")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> GetImportErrorFileAsync(
        [FromForm] IFormFile file,
        [FromForm] Guid? clinicBranchId) =>
        Excel(await service.GetErrorFileAsync(ToImportDto(file, clinicBranchId, dryRun: true)), "loi-migration");

    private static ImportDataMigrationDto ToImportDto(IFormFile file, Guid? clinicBranchId, bool dryRun) => new()
    {
        File = new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType, file.Length),
        ClinicBranchId = clinicBranchId,
        DryRun = dryRun
    };
}
