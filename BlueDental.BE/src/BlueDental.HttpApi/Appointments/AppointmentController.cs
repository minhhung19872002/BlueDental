using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Appointments;

[RemoteService]
[Authorize]
[Route("api/v1/app/appointments")]
public sealed class AppointmentController(IAppointmentAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<AppointmentDto>> GetListAsync(
        [FromQuery] GetAppointmentListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<AppointmentDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<AppointmentDto> CreateAsync([FromBody] CreateAppointmentDto input) =>
        service.CreateAsync(input);

    [HttpPost("temp")]
    public Task<AppointmentDto> CreateTempAsync([FromBody] CreateTempAppointmentDto input) =>
        service.CreateTempAsync(input);

    [HttpPut("{id:guid}")]
    public Task<AppointmentDto> UpdateAsync(Guid id, [FromBody] UpdateAppointmentDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/confirm")]
    public Task<AppointmentDto> ConfirmAsync(Guid id) => service.ConfirmAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<AppointmentDto> CancelAsync(Guid id, [FromBody] CancelAppointmentDto input) =>
        service.CancelAsync(id, input);

    [HttpPost("{id:guid}/check-in")]
    public Task<AppointmentDto> CheckInAsync(Guid id) => service.CheckInAsync(id);

    [HttpPost("{id:guid}/start")]
    public Task<AppointmentDto> StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task<AppointmentDto> CompleteAsync(Guid id, [FromBody] CompleteAppointmentDto input) =>
        service.CompleteAsync(id, input);

    [HttpPost("{id:guid}/no-show")]
    public Task<AppointmentDto> MarkNoShowAsync(Guid id) => service.MarkNoShowAsync(id);
}
