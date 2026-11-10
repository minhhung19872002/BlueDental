using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Timekeeping;

/// <summary>Lịch làm việc board (BA P0911, F-90).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/work-schedules")]
public sealed class WorkScheduleController(IWorkScheduleAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<WorkScheduleBoardDto> GetBoardAsync([FromQuery] GetWorkScheduleBoardInput input) =>
        service.GetBoardAsync(input);

    [HttpPost("save")]
    public Task<SaveWorkScheduleResultDto> SaveAsync([FromBody] SaveWorkScheduleInput input) =>
        service.SaveAsync(input);
}
