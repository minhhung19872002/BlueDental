using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;

namespace BlueDental.PatientManagement;

/// <summary>
/// Bệnh án của bệnh nhân.
///
/// Declared explicitly rather than left to ABP's conventional routing, which
/// does not produce the <c>api/v1/app/...</c> prefix the client calls.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-medical-records")]
public sealed class PatientMedicalRecordController(IPatientMedicalRecordAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientMedicalRecordDto>> GetListAsync(
        [FromQuery] GetPatientMedicalRecordListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientMedicalRecordDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientMedicalRecordDto> CreateAsync(
        [FromBody] CreatePatientMedicalRecordDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientMedicalRecordDto> UpdateAsync(
        Guid id,
        [FromBody] UpdatePatientMedicalRecordDto input) => service.UpdateAsync(id, input);

    /// <summary>"Hủy phiếu" — a sheet is never deleted; see the service.</summary>
    [HttpPost("{id:guid}/cancel")]
    public Task<PatientMedicalRecordDto> CancelAsync(
        Guid id,
        [FromBody] CancelPatientMedicalRecordDto input) => service.CancelAsync(id, input);

    /// <summary>Multipart, so the file is bound by hand rather than from a JSON body.</summary>
    [HttpPost("{id:guid}/drawings")]
    public Task<MedicalRecordDrawingDto> UploadDrawingAsync(Guid id, [FromForm] IFormFile? file) =>
        service.UploadDrawingAsync(id, new UploadMedicalRecordDrawingDto
        {
            File = file is null
                ? null
                : new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType),
        });

    [HttpGet("{id:guid}/drawings/{drawingId:guid}")]
    public async Task<IActionResult> GetDrawingAsync(Guid id, Guid drawingId)
    {
        IRemoteStreamContent content;
        try
        {
            content = await service.GetDrawingAsync(id, drawingId);
        }
        catch (EntityNotFoundException)
        {
            // ABP only turns this into a 404 for a JSON caller; an <img> is not
            // one, and would otherwise read a missing — or another branch's —
            // drawing as a server fault.
            return NotFound();
        }

        // A drawing is never changed in place — an edit stores a new one — so
        // the browser may keep it. Private: it is a patient's record.
        Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        return File(content.GetStream(), content.ContentType ?? "image/png");
    }
}
