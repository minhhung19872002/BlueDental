using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Records a single clinical encounter or treatment session linked to a treatment plan.
/// </summary>
public class TreatmentRecord : FullAuditedAggregateRoot<Guid>
{
    public Guid TreatmentPlanId { get; private set; }
    public Guid AppointmentId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid? ProcedureId { get; private set; }
    public string? TeethTreated { get; private set; }
    public string? ClinicalNotes { get; private set; }
    public string? Findings { get; private set; }
    public DateTimeOffset PerformedAt { get; private set; }
    public decimal? ChargedAmount { get; private set; }

    protected TreatmentRecord() { }

    public TreatmentRecord(
        Guid id,
        Guid treatmentPlanId,
        Guid appointmentId,
        Guid patientId,
        Guid dentistId,
        DateTimeOffset performedAt,
        Guid? procedureId = null,
        string? teethTreated = null,
        string? clinicalNotes = null,
        string? findings = null,
        decimal? chargedAmount = null)
        : base(id)
    {
        TreatmentPlanId = treatmentPlanId;
        AppointmentId = appointmentId;
        PatientId = patientId;
        DentistId = dentistId;
        PerformedAt = performedAt;
        ProcedureId = procedureId;
        TeethTreated = teethTreated;
        ClinicalNotes = clinicalNotes;
        Findings = findings;
        ChargedAmount = chargedAmount;
    }

    public TreatmentRecord UpdateNotes(string? clinicalNotes, string? findings)
    {
        ClinicalNotes = clinicalNotes;
        Findings = findings;
        return this;
    }
}
