using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

/// <summary>Phiếu điều trị.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-treatments")]
public sealed class PatientTreatmentController(IPatientTreatmentAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TreatmentPlanSlipDto>> GetListAsync(
        [FromQuery] GetTreatmentPlanSlipListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<TreatmentPlanSlipDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<TreatmentPlanSlipDto> OpenAsync([FromBody] OpenTreatmentPlanDto input) =>
        service.OpenAsync(input);

    [HttpPost("{id:guid}/discount")]
    public Task<TreatmentPlanSlipDto> ApplyDiscountAsync(
        Guid id, [FromBody] ApplyPlanDiscountDto input) => service.ApplyDiscountAsync(id, input);

    [HttpPost("{id:guid}/services/{serviceLineId:guid}/complete")]
    public Task<TreatmentPlanSlipDto> CompleteServiceAsync(Guid id, Guid serviceLineId) =>
        service.CompleteServiceAsync(id, serviceLineId);

    [HttpPost("{id:guid}/services/{serviceLineId:guid}/cancel")]
    public Task<TreatmentPlanSlipDto> CancelServiceAsync(Guid id, Guid serviceLineId) =>
        service.CancelServiceAsync(id, serviceLineId);

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> ExportPdfAsync(Guid id) =>
        Pdf(await service.ExportPdfAsync(id), $"phieu-dieu-tri-{id}");
}

/// <summary>Thanh toán của bệnh nhân.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-payments")]
public sealed class PatientPaymentController(IPatientPaymentAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientPaymentDto>> GetListAsync(
        [FromQuery] GetPatientPaymentListInput input) => service.GetListAsync(input);

    [HttpGet("account")]
    public Task<PatientAccountDto> GetAccountAsync(
        [FromQuery] Guid patientId, [FromQuery] Guid? clinicBranchId) =>
        service.GetAccountAsync(patientId, clinicBranchId);

    [HttpPost]
    public Task<PatientPaymentDto> RecordAsync([FromBody] RecordPatientPaymentDto input) =>
        service.RecordAsync(input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Đơn thuốc.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/prescriptions")]
public sealed class PrescriptionController(IPrescriptionAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PrescriptionDto>> GetListAsync(
        [FromQuery] GetPrescriptionListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PrescriptionDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PrescriptionDto> CreateAsync([FromBody] CreatePrescriptionDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PrescriptionDto> UpdateAsync(Guid id, [FromBody] UpdatePrescriptionDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/dispense")]
    public Task<PrescriptionDto> DispenseAsync(Guid id) => service.DispenseAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<PrescriptionDto> CancelAsync(Guid id) => service.CancelAsync(id);

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> ExportPdfAsync(Guid id) =>
        Pdf(await service.ExportPdfAsync(id), $"don-thuoc-{id}");

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
