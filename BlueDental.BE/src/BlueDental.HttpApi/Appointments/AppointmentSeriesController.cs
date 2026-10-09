using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Appointments;

[RemoteService]
[Authorize]
[Route("api/v1/app/appointment-series")]
public sealed class AppointmentSeriesController(IAppointmentSeriesAppService service) : BlueDentalController
{
    [HttpPost("preview")]
    public Task<AppointmentSeriesDto> PreviewAsync([FromBody] PreviewAppointmentSeriesInput input) =>
        service.PreviewAsync(input);

    [HttpPost]
    public Task<AppointmentSeriesDto> CreateAsync([FromBody] CreateAppointmentSeriesDto input) =>
        service.CreateAsync(input);

    [HttpGet("by-appointment/{appointmentId:guid}")]
    public Task<AppointmentSeriesDto> GetByAppointmentAsync(Guid appointmentId) =>
        service.GetByAppointmentAsync(appointmentId);
}
