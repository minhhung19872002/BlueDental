using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

/// <summary>Bộ hồ sơ bệnh án của bệnh nhân.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/medical-record-sets")]
public sealed class MedicalRecordSetController(IMedicalRecordSetAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<MedicalRecordSetDto>> GetListAsync([FromQuery] Guid patientId) =>
        service.GetListAsync(patientId);

    /// <summary>The patient's treatment slips, with the set holding each — what the set dialog offers.</summary>
    [HttpGet("plans")]
    public Task<ListResultDto<MedicalRecordSetPlanDto>> GetPlansAsync([FromQuery] Guid patientId) =>
        service.GetPlansAsync(patientId);

    [HttpPost]
    public Task<MedicalRecordSetDto> CreateAsync([FromBody] CreateMedicalRecordSetDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<MedicalRecordSetDto> UpdateAsync(Guid id, [FromBody] UpdateMedicalRecordSetDto input) =>
        service.UpdateAsync(id, input);

    /// <summary>"Hủy bộ hồ sơ" — a set is never deleted.</summary>
    [HttpPost("{id:guid}/cancel")]
    public Task<MedicalRecordSetDto> CancelAsync(Guid id) => service.CancelAsync(id);

    /// <summary>What the set's sheets print about its treatment slips (save/P1810.drawio).</summary>
    [HttpGet("{id:guid}/sheet-facts")]
    public Task<MedicalRecordSheetFactsDto> GetSheetFactsAsync(Guid id) => service.GetSheetFactsAsync(id);
}
