using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

/// <summary>Chẩn đoán của bệnh nhân.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-diagnoses")]
public sealed class PatientDiagnosisController(IPatientDiagnosisAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientDiagnosisDto>> GetListAsync(
        [FromQuery] GetPatientDiagnosisListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientDiagnosisDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientDiagnosisDto> CreateAsync([FromBody] CreatePatientDiagnosisDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientDiagnosisDto> UpdateAsync(Guid id, [FromBody] UpdatePatientDiagnosisDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/mark-treated")]
    public Task<PatientDiagnosisDto> MarkTreatedAsync(Guid id) => service.MarkTreatedAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<PatientDiagnosisDto> CancelAsync(Guid id) => service.CancelAsync(id);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Tư vấn dịch vụ.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-advises")]
public sealed class PatientAdviseController(IPatientAdviseAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientAdviseDto>> GetListAsync(
        [FromQuery] GetPatientAdviseListInput input) => service.GetListAsync(input);

    [HttpGet("summary")]
    public Task<PatientAdviseSummaryDto> GetSummaryAsync(
        [FromQuery] GetPatientAdviseListInput input) => service.GetSummaryAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientAdviseDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientAdviseDto> CreateAsync([FromBody] CreatePatientAdviseDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientAdviseDto> UpdateAsync(Guid id, [FromBody] UpdatePatientAdviseDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/accept")]
    public Task<PatientAdviseDto> AcceptAsync(Guid id) => service.AcceptAsync(id);

    [HttpPost("{id:guid}/reject")]
    public Task<PatientAdviseDto> RejectAsync(Guid id) => service.RejectAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<PatientAdviseDto> CancelAsync(Guid id) => service.CancelAsync(id);

    [HttpPost("{id:guid}/apply-voucher")]
    public Task<PatientAdviseDto> ApplyVoucherAsync(Guid id, [FromBody] decimal voucherDiscountAmount) =>
        service.ApplyVoucherAsync(id, voucherDiscountAmount);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Nhóm tư vấn.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/advise-groups")]
public sealed class AdviseGroupController(IAdviseGroupAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<AdviseGroupDto>> GetListAsync(
        [FromQuery] GetAdviseGroupListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<AdviseGroupDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<AdviseGroupDto> CreateAsync([FromBody] CreateAdviseGroupDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<AdviseGroupDto> UpdateAsync(Guid id, [FromBody] UpdateAdviseGroupDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Công đoạn điều trị.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/treatment-stages")]
public sealed class TreatmentStageController(ITreatmentStageAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TreatmentStageDto>> GetListAsync(
        [FromQuery] GetTreatmentStageListInput input) => service.GetListAsync(input);

    [HttpGet("progress")]
    public Task<TreatmentStageProgressDto> GetProgressAsync([FromQuery] Guid treatmentServiceId) =>
        service.GetProgressAsync(treatmentServiceId);

    [HttpGet("latest")]
    public Task<LatestTreatmentStageDto?> GetLatestAsync([FromQuery] Guid patientId) =>
        service.GetLatestAsync(patientId);

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
    public Task<TreatmentStageDto> AttachImageAsync(Guid id, [FromBody] AttachStageImageDto input) =>
        service.AttachImageAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
