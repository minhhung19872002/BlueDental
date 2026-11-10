using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Timekeeping;

/// <summary>
/// Lịch làm việc board (BA P0911, F-90): each person's S / C / SC days for a
/// month, grouped by the org chart, saved in one batch with "Lưu lịch".
/// Replaces the Chấm công board on the calendar's Lịch làm việc tab.
/// </summary>
public interface IWorkScheduleAppService : IApplicationService
{
    Task<WorkScheduleBoardDto> GetBoardAsync(GetWorkScheduleBoardInput input);

    Task<SaveWorkScheduleResultDto> SaveAsync(SaveWorkScheduleInput input);
}
