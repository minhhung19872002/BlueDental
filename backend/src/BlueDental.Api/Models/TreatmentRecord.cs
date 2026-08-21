namespace BlueDental.Api.Models;

public sealed class TreatmentRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public DateTime PerformedAtUtc { get; set; } = DateTime.UtcNow;
    public string? ToothNumber { get; set; }
    public required string Diagnosis { get; set; }
    public required string ProcedureName { get; set; }
    public decimal Cost { get; set; }
    public string? Notes { get; set; }
    public Patient? Patient { get; set; }
    public Dentist? Dentist { get; set; }
}
