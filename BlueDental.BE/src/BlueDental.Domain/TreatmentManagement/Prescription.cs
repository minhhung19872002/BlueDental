using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Prescription issued as part of a treatment record.
/// </summary>
public class Prescription : FullAuditedAggregateRoot<Guid>
{
    public Guid TreatmentRecordId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid PrescribedBy { get; private set; }
    public Guid MedicationId { get; private set; }
    public string Dosage { get; private set; } = default!;
    public string Frequency { get; private set; } = default!;
    public int DurationDays { get; private set; }
    public string? Instructions { get; private set; }
    public PrescriptionStatus Status { get; private set; }
    public DateTimeOffset IssuedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }

    protected Prescription() { }

    public Prescription(
        Guid id,
        Guid treatmentRecordId,
        Guid patientId,
        Guid prescribedBy,
        Guid medicationId,
        string dosage,
        string frequency,
        int durationDays,
        string? instructions = null)
        : base(id)
    {
        TreatmentRecordId = treatmentRecordId;
        PatientId = patientId;
        PrescribedBy = prescribedBy;
        MedicationId = medicationId;
        Dosage = dosage;
        Frequency = frequency;
        DurationDays = durationDays;
        Instructions = instructions;
        Status = PrescriptionStatus.Active;
        IssuedAt = DateTimeOffset.UtcNow;
        ExpiresAt = DateTimeOffset.UtcNow.AddDays(durationDays + 7);
    }

    public Prescription Dispense()
    {
        if (Status != PrescriptionStatus.Active)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                $"Prescription cannot be dispensed in status {Status}.");
        }

        Status = PrescriptionStatus.Dispensed;
        return this;
    }

    public Prescription Cancel()
    {
        if (Status is PrescriptionStatus.Dispensed or PrescriptionStatus.Cancelled)
        {
            throw new BusinessException(
                "BlueDental:Prescription:InvalidTransition",
                $"Prescription cannot be cancelled in status {Status}.");
        }

        Status = PrescriptionStatus.Cancelled;
        return this;
    }
}
