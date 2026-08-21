using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        return Ok(new
        {
            patientCount = await database.Patients.CountAsync(cancellationToken),
            appointmentsToday = await database.Appointments.CountAsync(appointment => appointment.StartAtUtc.Date == today, cancellationToken),
            pendingAppointments = await database.Appointments.CountAsync(appointment => appointment.Status == AppointmentStatus.Scheduled, cancellationToken)
        });
    }
}
