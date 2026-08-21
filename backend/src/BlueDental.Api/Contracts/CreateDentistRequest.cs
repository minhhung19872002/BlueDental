namespace BlueDental.Api.Contracts;

public sealed record CreateDentistRequest(string FullName, string Specialty, string? PhoneNumber);
