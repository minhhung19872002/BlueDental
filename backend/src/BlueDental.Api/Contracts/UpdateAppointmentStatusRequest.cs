using BlueDental.Api.Models;

namespace BlueDental.Api.Contracts;

public sealed record UpdateAppointmentStatusRequest(AppointmentStatus Status);
