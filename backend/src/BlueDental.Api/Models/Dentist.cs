namespace BlueDental.Api.Models;

public sealed class Dentist
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FullName { get; set; }
    public required string Specialty { get; set; }
    public string? PhoneNumber { get; set; }
    public ICollection<Appointment> Appointments { get; set; } = [];
}
