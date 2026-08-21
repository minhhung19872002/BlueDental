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
    public async Task<ActionResult<IEnumerable<Patient>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await database.Patients.AsNoTracking().OrderBy(patient => patient.FullName).ToListAsync(cancellationToken));

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
}
