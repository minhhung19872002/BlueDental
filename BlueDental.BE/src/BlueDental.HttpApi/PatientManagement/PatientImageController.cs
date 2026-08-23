using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

/// <summary>Hình ảnh bệnh nhân.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-images")]
public sealed class PatientImageController(IPatientImageAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientImageDto>> GetListAsync(
        [FromQuery] GetPatientImageListInput input) => service.GetListAsync(input);

    /// <summary>
    /// Multipart upload. The file arrives as a form field, so the DTO is bound by
    /// hand rather than from the JSON body.
    /// </summary>
    [HttpPost]
    public Task<PatientImageDto> UploadAsync(
        [FromForm] IFormFile file,
        [FromForm] Guid patientId,
        [FromForm] Guid clinicBranchId,
        [FromForm] Guid? treatmentPlanId,
        [FromForm] Guid? treatmentStageId,
        [FromForm] string? note)
    {
        return service.UploadAsync(new UploadPatientImageDto
        {
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            TreatmentPlanId = treatmentPlanId,
            TreatmentStageId = treatmentStageId,
            Note = note,
            File = new RemoteStreamContent(
                file.OpenReadStream(),
                file.FileName,
                file.ContentType,
                file.Length)
        });
    }

    [HttpGet("{id:guid}/content")]
    public async Task<IActionResult> GetContentAsync(Guid id)
    {
        var stream = await service.GetContentAsync(id);
        return File(stream, "application/octet-stream");
    }

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
