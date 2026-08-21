using BlueDental.Api.Contracts;
using BlueDental.Api.Data;
using BlueDental.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Controllers;

[ApiController]
[Route("api/payments")]
public sealed class PaymentsController(DentalDbContext database) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Payment>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await database.Payments.AsNoTracking()
            .Include(payment => payment.Patient)
            .OrderByDescending(payment => payment.PaidAtUtc)
            .ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<Payment>> Create(CreatePaymentRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            return BadRequest("Số tiền thanh toán phải lớn hơn 0.");
        }

        if (!await database.Patients.AnyAsync(patient => patient.Id == request.PatientId, cancellationToken))
        {
            return BadRequest("Bệnh nhân không tồn tại.");
        }

        var payment = new Payment
        {
            PatientId = request.PatientId, Amount = request.Amount,
            Method = request.Method, Notes = request.Notes
        };
        database.Payments.Add(payment);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { payment.Id }, payment);
    }
}
