using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

[RemoteService]
[Authorize]
[Route("api/v1/app/treatment-plans")]
public sealed class TreatmentPlanController(ITreatmentPlanAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TreatmentPlanDto>> GetListAsync(
        [FromQuery] GetTreatmentPlanListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<TreatmentPlanDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<TreatmentPlanDto> CreateAsync([FromBody] CreateTreatmentPlanDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TreatmentPlanDto> UpdateAsync(Guid id, [FromBody] UpdateTreatmentPlanDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/submit")]
    public Task<TreatmentPlanDto> SubmitForApprovalAsync(Guid id) =>
        service.SubmitForApprovalAsync(id);

    [HttpPost("{id:guid}/approve")]
    public Task<TreatmentPlanDto> ApproveAsync(Guid id, [FromBody] ApproveTreatmentPlanDto input) =>
        service.ApproveAsync(id, input);

    [HttpPost("{id:guid}/start")]
    public Task<TreatmentPlanDto> StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task<TreatmentPlanDto> CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<TreatmentPlanDto> CancelAsync(Guid id) => service.CancelAsync(id);
}
