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
        [FromForm] string? note,
        [FromForm] PatientImageType? type,
        [FromForm] Guid? folderId)
    {
        return service.UploadAsync(new UploadPatientImageDto
        {
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            TreatmentPlanId = treatmentPlanId,
            TreatmentStageId = treatmentStageId,
            Note = note,
            Type = type ?? PatientImageType.Before,
            FolderId = folderId,
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

    /// <summary>Reference: <c>PUT /patient-images/reorder</c>.</summary>
    [HttpPut("reorder")]
    public Task ReorderAsync([FromBody] ReorderPatientImageDto input) => service.ReorderAsync(input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    /// <summary>The selection's "Xoá N ảnh" (R-1277); a POST, since a DELETE carries no body.</summary>
    [HttpPost("delete-many")]
    public Task DeleteManyAsync([FromBody] DeletePatientImagesDto input) => service.DeleteManyAsync(input);

    /// <summary>The selection's "Chuyển vào thư mục" (F-98).</summary>
    [HttpPost("move")]
    public Task MoveManyAsync([FromBody] MovePatientImagesDto input) => service.MoveManyAsync(input);
}
