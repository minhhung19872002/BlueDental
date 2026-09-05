using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Appointments;

/// <summary>
/// Read side of the appointment change history ("Lịch sử thay đổi lịch hẹn").
/// Rows are written by the appointment service itself; nothing writes here.
/// </summary>
public interface IAppointmentChangeLogAppService : IApplicationService
{
    Task<PagedResultDto<AppointmentChangeLogDto>> GetListAsync(GetAppointmentChangeLogListInput input);
    Task<AppointmentChangeLogStatsDto> GetStatsAsync(GetAppointmentChangeLogListInput input);
}
