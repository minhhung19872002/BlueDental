using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

public class DiagnosticRecord : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid? AppointmentId { get; private set; }
    public string? TeethNumbers { get; private set; }
    public string? Notes { get; private set; }
    public string? Diagnosis { get; private set; }

    protected DiagnosticRecord() { }

    public DiagnosticRecord(
        Guid id,
        string code,
        Guid patientId,
        Guid dentistId,
        Guid? appointmentId = null,
        string? teethNumbers = null,
        string? diagnosis = null,
        string? notes = null)
        : base(id)
    {
        Code = code;
        PatientId = patientId;
        DentistId = dentistId;
        AppointmentId = appointmentId;
        TeethNumbers = teethNumbers;
        Diagnosis = diagnosis;
        Notes = notes;
    }

    public DiagnosticRecord Update(string? teethNumbers, string? diagnosis, string? notes)
    {
        TeethNumbers = teethNumbers;
        Diagnosis = diagnosis;
        Notes = notes;
        return this;
    }
}
