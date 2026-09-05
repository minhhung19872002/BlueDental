using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Appointments;

/// <summary>
/// Lịch sử thay đổi lịch hẹn. Read only: the rows are written by
/// <see cref="AppointmentAppService"/> as a side effect of every save.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/appointment-change-log")]
public sealed class AppointmentChangeLogController(IAppointmentChangeLogAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<AppointmentChangeLogDto>> GetListAsync(
        [FromQuery] GetAppointmentChangeLogListInput input) => service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<AppointmentChangeLogStatsDto> GetStatsAsync(
        [FromQuery] GetAppointmentChangeLogListInput input) => service.GetStatsAsync(input);
}
