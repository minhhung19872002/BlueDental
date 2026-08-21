namespace BlueDental.Api.Models;

public enum AppointmentStatus
{
    Scheduled,
    Confirmed,
    Completed,
    Cancelled
}

public sealed class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public DateTime StartAtUtc { get; set; }
    public int DurationMinutes { get; set; } = 30;
    public required string Reason { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public string? Notes { get; set; }
    public Patient? Patient { get; set; }
    public Dentist? Dentist { get; set; }
}
