using BlueDental.Api.Contracts;
using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/treatment-records")]
public sealed class TreatmentRecordsController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TreatmentRecord>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await database.TreatmentRecords.AsNoTracking()
            .Include(record => record.Patient)
            .Include(record => record.Dentist)
            .OrderByDescending(record => record.PerformedAtUtc)
            .ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<TreatmentRecord>> Create(CreateTreatmentRecordRequest request, CancellationToken cancellationToken)
    {
        var patientExists = await database.Patients.AnyAsync(patient => patient.Id == request.PatientId, cancellationToken);
        var dentistExists = await database.Dentists.AnyAsync(dentist => dentist.Id == request.DentistId, cancellationToken);
        if (!patientExists || !dentistExists)
        {
            return BadRequest("Bệnh nhân hoặc nha sĩ không tồn tại.");
        }

        var record = new TreatmentRecord
        {
            PatientId = request.PatientId, DentistId = request.DentistId,
            PerformedAtUtc = request.PerformedAtUtc, ToothNumber = request.ToothNumber,
            Diagnosis = request.Diagnosis.Trim(), ProcedureName = request.ProcedureName.Trim(),
            Cost = request.Cost, Notes = request.Notes
        };
        database.TreatmentRecords.Add(record);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { record.Id }, record);
    }
}
