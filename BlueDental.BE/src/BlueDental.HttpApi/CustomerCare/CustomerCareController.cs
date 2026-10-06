using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

/// <summary>Chăm sóc khách hàng (CSKH).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/care-records")]
public sealed class CustomerCareController(ICustomerCareAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<CareRecordDto>> GetListAsync([FromQuery] GetCareRecordListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<CareStatsDto> GetStatsAsync([FromQuery] GetCareRecordListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<CareRecordDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<CareRecordDto> CreateAsync([FromBody] CreateCareRecordDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<CareRecordDto> UpdateAsync(Guid id, [FromBody] UpdateCareRecordDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPost("{id:guid}/contacted")]
    public Task<CareRecordDto> MarkContactedAsync(Guid id) => service.MarkContactedAsync(id);

    /// <summary>Đã liên hệ / Chưa liên hệ of the sau-điều-trị tab.</summary>
    [HttpPut("{id:guid}/contact-status")]
    public Task<CareRecordDto> SetContactStatusAsync(Guid id, [FromBody] SetCareContactStatusDto input) =>
        service.SetContactStatusAsync(id, input);

    /// <summary>Lịch sử liên hệ, newest first.</summary>
    [HttpGet("{id:guid}/contact-logs")]
    public Task<List<CareContactLogDto>> GetContactLogsAsync(Guid id) => service.GetContactLogsAsync(id);

    [HttpPost("{id:guid}/succeed")]
    public Task<CareRecordDto> SucceedAsync(Guid id, [FromBody] SucceedCareRecordDto input) =>
        service.SucceedAsync(id, input);

    [HttpPost("{id:guid}/fail")]
    public Task<CareRecordDto> FailAsync(Guid id, [FromBody] FailCareRecordDto input) =>
        service.FailAsync(id, input);

    [HttpPost("{id:guid}/zalo-sent")]
    public Task<CareRecordDto> MarkZaloSentAsync(Guid id) => service.MarkZaloSentAsync(id);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] GetCareRecordListInput input) =>
        Excel(await service.ExportAsync(input), ExportName(input.Type));

    [HttpPost("{id:guid}/cancel")]
    public Task CancelAsync(Guid id, [FromBody] string reason) => service.CancelAsync(id, reason);

    /// <summary>Phân nhóm CSKH — patient list with treatment/care rollups.</summary>
    [HttpGet("grouping-patients")]
    public Task<PagedResultDto<CareGroupingPatientDto>> GetGroupingPatientsAsync(
        [FromQuery] GetCareGroupingPatientsInput input) =>
        service.GetGroupingPatientsAsync(input);

    /// <summary>Reference downloads e.g. <c>cskh-dac-biet.xlsx</c> — kebab per tab.</summary>
    private static string ExportName(CareType? type) => type switch
    {
        CareType.AfterTreatment => "cskh-sau-dieu-tri",
        CareType.Birthday => "cskh-sinh-nhat",
        CareType.AppointmentReminder => "cskh-nhac-lich-hen",
        CareType.Periodic => "cskh-dinh-ky",
        CareType.Special => "cskh-dac-biet",
        CareType.NoService => "cskh-khong-lam-dich-vu",
        CareType.MissedAppointment => "cskh-dat-lich-khong-den",
        CareType.CancelledAppointment => "cskh-lich-hen-huy",
        CareType.Complaint => "cskh-complain",
        _ => "cskh",
    };
}
