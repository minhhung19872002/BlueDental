using BlueDental.Api.Contracts;
using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/appointments")]
public sealed class AppointmentsController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Appointment>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await database.Appointments.AsNoTracking()
            .Include(appointment => appointment.Patient)
            .Include(appointment => appointment.Dentist)
            .OrderBy(appointment => appointment.StartAtUtc)
            .ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<Appointment>> Create(CreateAppointmentRequest request, CancellationToken cancellationToken)
    {
        if (!await database.Patients.AnyAsync(patient => patient.Id == request.PatientId, cancellationToken) ||
            !await database.Dentists.AnyAsync(dentist => dentist.Id == request.DentistId, cancellationToken))
        {
            return BadRequest("Bệnh nhân hoặc nha sĩ không tồn tại.");
        }

        var appointment = new Appointment
        {
            PatientId = request.PatientId, DentistId = request.DentistId,
            StartAtUtc = request.StartAtUtc, DurationMinutes = request.DurationMinutes,
            Reason = request.Reason.Trim(), Notes = request.Notes
        };
        database.Appointments.Add(appointment);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { appointment.Id }, appointment);
    }
}
