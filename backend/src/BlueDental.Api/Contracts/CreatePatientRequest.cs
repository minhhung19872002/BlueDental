namespace BlueDental.Api.Contracts;

public sealed record CreatePatientRequest(
    string FullName,
    DateOnly? DateOfBirth,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? MedicalNotes);
