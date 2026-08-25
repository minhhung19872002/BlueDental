using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Công đoạn điều trị.
///
/// TreatmentStageAppService and its interface have both existed for a while,
/// and the frontend ships a full stageApi.ts against /v1/app/treatment-stages,
/// but nothing ever exposed the routes — every call answered 404. This project
/// declares its controllers explicitly rather than relying on ABP's
/// conventional ones, and this service was the one that never got hers.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/treatment-stages")]
public sealed class TreatmentStageController(ITreatmentStageAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TreatmentStageDto>> GetListAsync(
        [FromQuery] GetTreatmentStageListInput input) => service.GetListAsync(input);

    [HttpGet("latest")]
    public Task<LatestTreatmentStageDto?> GetLatestAsync([FromQuery] Guid patientId) =>
        service.GetLatestAsync(patientId);

    [HttpGet("progress")]
    public Task<TreatmentStageProgressDto> GetProgressAsync([FromQuery] Guid treatmentServiceId) =>
        service.GetProgressAsync(treatmentServiceId);

    [HttpGet("{id:guid}")]
    public Task<TreatmentStageDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<TreatmentStageDto> CreateAsync([FromBody] CreateTreatmentStageDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TreatmentStageDto> UpdateAsync(Guid id, [FromBody] UpdateTreatmentStageDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/continue")]
    public Task<TreatmentStageDto> ContinueAsync(Guid id) => service.ContinueAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task<TreatmentStageDto> CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpPost("{id:guid}/images")]
    public Task<TreatmentStageDto> AttachImageAsync(
        Guid id, [FromBody] AttachStageImageDto input) => service.AttachImageAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
