using BlueDental.Api.Contracts;
using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/dentists")]
public sealed class DentistsController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Dentist>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await database.Dentists.AsNoTracking().OrderBy(dentist => dentist.FullName).ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<Dentist>> Create(CreateDentistRequest request, CancellationToken cancellationToken)
    {
        var dentist = new Dentist
        {
            FullName = request.FullName.Trim(),
            Specialty = request.Specialty.Trim(),
            PhoneNumber = request.PhoneNumber?.Trim()
        };
        database.Dentists.Add(dentist);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { dentist.Id }, dentist);
    }
}
