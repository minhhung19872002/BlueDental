using System;
using Volo.Abp.Domain.Entities;

namespace BlueDental.PatientManagement;

/// <summary>
/// A treatment slip held by a <see cref="MedicalRecordSet"/>.
///
/// Keeps the slip's doctor as it was when the slip joined: each slip has its
/// own, and a set opened for several slips keeps every one of them.
/// </summary>
public class MedicalRecordSetPlan : Entity
{
    public Guid MedicalRecordSetId { get; private set; }
    public Guid TreatmentPlanId { get; private set; }
    public Guid DentistId { get; private set; }
    public DateTime AttachedAt { get; private set; }

    /// <summary>
    /// Set when the set is cancelled: the link is kept as history, but the slip
    /// is free to join another set. Only unreleased links are unique per slip.
    /// </summary>
    public bool Released { get; private set; }

    protected MedicalRecordSetPlan() { }

    internal MedicalRecordSetPlan(Guid medicalRecordSetId, Guid treatmentPlanId, Guid dentistId, DateTime attachedAt)
    {
        MedicalRecordSetId = medicalRecordSetId;
        TreatmentPlanId = treatmentPlanId;
        DentistId = dentistId;
        AttachedAt = attachedAt;
    }

    internal void Release() => Released = true;

    public override object[] GetKeys() => [MedicalRecordSetId, TreatmentPlanId];
}
