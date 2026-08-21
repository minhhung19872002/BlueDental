using BlueDental.Api.Contracts;
using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/patients")]
public sealed class PatientsController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Patient>>> GetAll([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var patients = database.Patients.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            patients = patients.Where(patient => patient.FullName.Contains(term) || patient.PhoneNumber.Contains(term));
        }

        return Ok(await patients.OrderBy(patient => patient.FullName).ToListAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Patient>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var patient = await database.Patients.AsNoTracking().SingleOrDefaultAsync(patient => patient.Id == id, cancellationToken);
        return patient is null ? NotFound() : Ok(patient);
    }

    [HttpPost]
    public async Task<ActionResult<Patient>> Create(CreatePatientRequest request, CancellationToken cancellationToken)
    {
        var patient = new Patient
        {
            FullName = request.FullName.Trim(), DateOfBirth = request.DateOfBirth,
            PhoneNumber = request.PhoneNumber.Trim(), Email = request.Email,
            Address = request.Address, MedicalNotes = request.MedicalNotes
        };
        database.Patients.Add(patient);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { patient.Id }, patient);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CreatePatientRequest request, CancellationToken cancellationToken)
    {
        var patient = await database.Patients.FindAsync([id], cancellationToken);
        if (patient is null)
        {
            return NotFound();
        }

        patient.FullName = request.FullName.Trim();
        patient.DateOfBirth = request.DateOfBirth;
        patient.PhoneNumber = request.PhoneNumber.Trim();
        patient.Email = request.Email;
        patient.Address = request.Address;
        patient.MedicalNotes = request.MedicalNotes;
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
