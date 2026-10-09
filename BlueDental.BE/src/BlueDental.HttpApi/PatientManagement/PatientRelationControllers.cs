using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

/// <summary>Mối quan hệ (function list 4.8). BlueDental-local.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-relations")]
public sealed class PatientRelationshipController(IPatientRelationshipAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<PatientRelationDto>> GetListAsync([FromQuery] Guid patientId) =>
        service.GetListAsync(patientId);

    [HttpGet("family")]
    public Task<ListResultDto<PatientRelationDto>> GetFamilyAsync([FromQuery] Guid patientId) =>
        service.GetFamilyAsync(patientId);

    [HttpPost]
    public Task<PatientRelationDto> CreateAsync([FromBody] CreatePatientRelationDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientRelationDto> UpdateAsync(Guid id, [FromBody] UpdatePatientRelationDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Hồ sơ nhóm (function list 4.10). BlueDental-local.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-groups")]
public sealed class PatientGroupController(IPatientGroupAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientGroupDto>> GetListAsync([FromQuery] GetPatientGroupListInput input) =>
        service.GetListAsync(input);

    [HttpGet("by-patient")]
    public Task<ListResultDto<PatientGroupDetailDto>> GetByPatientAsync([FromQuery] Guid patientId) =>
        service.GetByPatientAsync(patientId);

    [HttpGet("{id:guid}")]
    public Task<PatientGroupDetailDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientGroupDetailDto> CreateAsync([FromBody] SavePatientGroupDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientGroupDetailDto> UpdateAsync(Guid id, [FromBody] SavePatientGroupDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
