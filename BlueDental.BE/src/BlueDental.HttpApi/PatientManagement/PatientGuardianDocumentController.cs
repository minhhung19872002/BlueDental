using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

/// <summary>Giấy tờ chứng minh quyền giám hộ — upload before the hồ sơ save, download after.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patients")]
public sealed class PatientGuardianDocumentController(IPatientGuardianDocumentAppService service) : BlueDentalController
{
    [HttpPost("guardian-documents")]
    public Task<GuardianDocumentDto> UploadAsync([FromForm] IFormFile file) =>
        service.UploadAsync(new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType));

    [HttpGet("{id:guid}/guardians/{guardianId:guid}/document")]
    public async Task<IActionResult> GetAsync(Guid id, Guid guardianId)
    {
        var content = await service.GetAsync(id, guardianId);

        return File(content.GetStream(), content.ContentType ?? "application/octet-stream", content.FileName);
    }
}
