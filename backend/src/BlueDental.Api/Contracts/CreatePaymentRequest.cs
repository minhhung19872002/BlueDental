using BlueDental.Api.Models;

namespace BlueDental.Api.Contracts;

public sealed record CreatePaymentRequest(Guid PatientId, decimal Amount, PaymentMethod Method, string? Notes);
