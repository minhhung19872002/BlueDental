namespace BlueDental.Api.Models;

public sealed class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FullName { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public required string PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? MedicalNotes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public ICollection<Appointment> Appointments { get; set; } = [];
}
