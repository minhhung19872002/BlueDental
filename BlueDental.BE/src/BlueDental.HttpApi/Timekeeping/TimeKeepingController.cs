using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Timekeeping;

/// <summary>Chấm công / Lịch làm việc.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/time-keepings")]
public sealed class TimeKeepingController(ITimeKeepingAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TimeKeepingRecordDto>> GetListAsync(
        [FromQuery] GetTimeKeepingListInput input) => service.GetListAsync(input);

    [HttpGet("summary")]
    public Task<TimeKeepingSummaryDto> GetSummaryAsync(
        [FromQuery] Guid clinicBranchId, [FromQuery] DateOnly workDate) =>
        service.GetSummaryAsync(clinicBranchId, workDate);

    [HttpGet("{id:guid}")]
    public Task<TimeKeepingRecordDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost("open-day")]
    public Task<TimeKeepingRecordDto> OpenWorkDayAsync([FromBody] OpenWorkDayDto input) =>
        service.OpenWorkDayAsync(input);

    [HttpPost("{id:guid}/register-working")]
    public Task<TimeKeepingRecordDto> RegisterWorkingAsync(Guid id) =>
        service.RegisterWorkingAsync(id);

    [HttpPost("{id:guid}/register-day-off")]
    public Task<TimeKeepingRecordDto> RegisterDayOffAsync(Guid id, [FromBody] RegisterDayOffInput input) =>
        service.RegisterDayOffAsync(id, input);

    [HttpPost("{id:guid}/check-in")]
    public Task<TimeKeepingRecordDto> CheckInAsync(Guid id, [FromBody] AttendanceInput input) =>
        service.CheckInAsync(id, input);

    [HttpPost("{id:guid}/check-out")]
    public Task<TimeKeepingRecordDto> CheckOutAsync(Guid id, [FromBody] AttendanceInput input) =>
        service.CheckOutAsync(id, input);

    [HttpPost("{id:guid}/overtime")]
    public Task<TimeKeepingRecordDto> AddOvertimeAsync(Guid id, [FromBody] AddOvertimeInput input) =>
        service.AddOvertimeAsync(id, input);

    [HttpPost("close-abandoned")]
    public Task<int> CloseAbandonedShiftsAsync(
        [FromQuery] Guid clinicBranchId, [FromQuery] DateOnly workDate) =>
        service.CloseAbandonedShiftsAsync(clinicBranchId, workDate);
}
