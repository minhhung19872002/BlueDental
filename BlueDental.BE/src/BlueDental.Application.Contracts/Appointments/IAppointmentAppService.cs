using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Appointments;

public interface IAppointmentAppService : IApplicationService
{
    Task<PagedResultDto<AppointmentDto>> GetListAsync(GetAppointmentListInput input);
    Task<AppointmentDto> GetAsync(Guid id);
    Task<AppointmentDto> CreateAsync(CreateAppointmentDto input);
    Task<AppointmentDto> CreateTempAsync(CreateTempAppointmentDto input);
    Task<AppointmentDto> UpdateAsync(Guid id, UpdateAppointmentDto input);
    Task<AppointmentDto> ConfirmAsync(Guid id);
    Task<AppointmentDto> CancelAsync(Guid id, CancelAppointmentDto input);
    Task<AppointmentDto> CheckInAsync(Guid id);
    Task<AppointmentDto> StartAsync(Guid id);
    Task<AppointmentDto> CompleteAsync(Guid id, CompleteAppointmentDto input);
    Task<AppointmentDto> MarkNoShowAsync(Guid id);
}
