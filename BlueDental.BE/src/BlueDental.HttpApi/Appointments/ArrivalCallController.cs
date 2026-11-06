using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Appointments;

[RemoteService]
[Authorize]
[Route("api/v1/app/arrival-calls")]
public sealed class ArrivalCallController(IArrivalCallAppService service) : BlueDentalController
{
    [HttpGet("waiting")]
    public Task<List<ArrivalCallDto>> GetWaitingAsync([FromQuery] GetWaitingArrivalsInput input) =>
        service.GetWaitingAsync(input);

    [HttpGet("doctors")]
    public Task<List<ArrivalDoctorDto>> GetDoctorsAsync() => service.GetDoctorsAsync();

    [HttpGet("invited")]
    public Task<List<ArrivalCallDto>> GetInvitedAsync() => service.GetInvitedAsync();

    [HttpPost("{id:guid}/invite")]
    public Task<ArrivalCallDto> InviteAsync(Guid id) => service.InviteAsync(id);

    [HttpPost("{id:guid}/admit")]
    public Task<ArrivalCallDto> AdmitAsync(Guid id) => service.AdmitAsync(id);
}
