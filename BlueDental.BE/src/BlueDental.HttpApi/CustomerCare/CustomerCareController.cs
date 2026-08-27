using System;
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

    [HttpPost("{id:guid}/contacted")]
    public Task<CareRecordDto> MarkContactedAsync(Guid id) => service.MarkContactedAsync(id);

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
        _ => "cskh",
    };
}
