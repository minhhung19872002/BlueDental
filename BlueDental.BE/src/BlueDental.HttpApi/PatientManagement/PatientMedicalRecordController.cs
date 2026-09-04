using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

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

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
