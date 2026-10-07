using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

/// <summary>Nhân viên → Bảng lương (Cụm 11 mục 5–6).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/payroll")]
public sealed class PayrollController(IPayrollAppService service) : BlueDentalController
{
    [HttpGet("periods")]
    public Task<ListResultDto<PayrollPeriodSummaryDto>> GetListAsync([FromQuery] GetPayrollPeriodListInput input) =>
        service.GetListAsync(input);

    [HttpGet("periods/{id:guid}")]
    public Task<PayrollPeriodDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost("periods")]
    public Task<PayrollPeriodDto> CreateAsync([FromBody] CreatePayrollPeriodDto input) => service.CreateAsync(input);

    [HttpPost("periods/{id:guid}/recalculate")]
    public Task<PayrollPeriodDto> RecalculateAsync(Guid id) => service.RecalculateAsync(id);

    [HttpPut("periods/{id:guid}/terms")]
    public Task<PayrollPeriodDto> UpdateTermsAsync(Guid id, [FromBody] UpdatePayrollTermsDto input) =>
        service.UpdateTermsAsync(id, input);

    [HttpPut("periods/{id:guid}/entries/{staffId:guid}")]
    public Task<PayrollPeriodDto> UpdateEntryAsync(Guid id, Guid staffId, [FromBody] UpdatePayrollEntryDto input) =>
        service.UpdateEntryAsync(id, staffId, input);

    [HttpPost("periods/{id:guid}/finalize")]
    public Task<PayrollPeriodDto> FinalizeAsync(Guid id) => service.FinalizeAsync(id);

    [HttpDelete("periods/{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpGet("periods/{id:guid}/excel")]
    public async Task<IActionResult> ExportAsync(Guid id) =>
        Excel(await service.ExportAsync(id), "bang-luong");

    [HttpGet("compensations")]
    public Task<ListResultDto<StaffCompensationDto>> GetCompensationsAsync([FromQuery] GetStaffCompensationListInput input) =>
        service.GetCompensationsAsync(input);

    [HttpPut("compensations/{staffId:guid}")]
    public Task<StaffCompensationDto> SetCompensationAsync(Guid staffId, [FromBody] SetStaffCompensationDto input) =>
        service.SetCompensationAsync(staffId, input);
}
