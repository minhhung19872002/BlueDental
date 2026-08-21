namespace BlueDental.Api.Contracts;

public sealed record CreateTreatmentRecordRequest(
    Guid PatientId,
    Guid DentistId,
    DateTime PerformedAtUtc,
    string? ToothNumber,
    string Diagnosis,
    string ProcedureName,
    decimal Cost,
    string? Notes);
