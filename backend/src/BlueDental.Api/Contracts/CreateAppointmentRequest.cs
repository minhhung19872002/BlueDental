using BlueDental.Api.Models;

namespace BlueDental.Api.Contracts;

public sealed record CreateAppointmentRequest(
    Guid PatientId,
    Guid DentistId,
    DateTime StartAtUtc,
    int DurationMinutes,
    string Reason,
    string? Notes);
