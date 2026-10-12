using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.PatientManagement.Roster;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

/// <summary>Xuất / nhập danh sách bệnh nhân (F-69): the patient page's admin buttons.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-roster")]
public sealed class PatientRosterController(IPatientRosterAppService service) : BlueDentalController
{
    /// <summary>Every live patient of every branch, in the file the import reads back.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> ExportAsync() =>
        Excel(await service.ExportAsync(), "danh-sach-benh-nhan");

    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public Task<PatientRosterResultDto> ImportAsync([FromForm] IFormFile file, [FromForm] bool dryRun) =>
        service.ImportAsync(ToImportDto(file, dryRun));

    /// <summary>The same file back, with a "Lỗi" column beside the refused rows.</summary>
    [HttpPost("import-errors")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> GetImportErrorFileAsync([FromForm] IFormFile file) =>
        Excel(await service.GetErrorFileAsync(ToImportDto(file, dryRun: true)), "loi-danh-sach-benh-nhan");

    private static ImportPatientRosterDto ToImportDto(IFormFile file, bool dryRun) => new()
    {
        File = new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType, file.Length),
        DryRun = dryRun
    };
}
