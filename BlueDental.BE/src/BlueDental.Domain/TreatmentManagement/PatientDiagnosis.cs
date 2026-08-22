using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// A diagnosis recorded against a patient for a specific set of teeth
/// (Chẩn đoán của bệnh nhân).
///
/// Reference: <c>GET /api/v1/patient-diagnoses</c>. It is the first step of the
/// clinical chain: Diagnosis catalog -> PatientDiagnosis -> PatientAdvise -> TreatmentPlan.
/// </summary>
public class PatientDiagnosis : FullAuditedAggregateRoot<Guid>
{
    private readonly List<ToothSelection> _teeth = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Catalog entry being diagnosed (Danh mục chẩn đoán).</summary>
    public Guid DiagnosisId { get; private set; }

    /// <summary>Examining dentist.</summary>
    public Guid StaffId { get; private set; }

    /// <summary>Optional supporting dentist / assistant (bác sĩ hỗ trợ).</summary>
    public Guid? SecondStaffId { get; private set; }

    /// <summary>Human-readable code shown in the UI.</summary>
    public string Code { get; private set; } = string.Empty;

    public string? Note { get; private set; }

    public PatientDiagnosisStatus Status { get; private set; }

    /// <summary>
    /// True once at least one treatment service has been created from this diagnosis.
    /// Mirrors the reference field <c>hasTreatmentService</c>.
    /// </summary>
    public bool HasTreatmentService { get; private set; }

    /// <summary>Teeth and surfaces covered by this diagnosis.</summary>
    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();

    protected PatientDiagnosis() { }

    public static PatientDiagnosis Record(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        Guid diagnosisId,
        Guid staffId,
        string code,
        IEnumerable<ToothSelection> teeth,
        string? note = null,
        Guid? secondStaffId = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        if (toothList.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection,
                "A diagnosis must cover at least one tooth.");
        }

        GuardNoDuplicateTeeth(toothList);

        var diagnosis = new PatientDiagnosis
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            DiagnosisId = diagnosisId,
            StaffId = staffId,
            SecondStaffId = secondStaffId,
            Code = code,
            Note = note,
            Status = PatientDiagnosisStatus.Created,
            HasTreatmentService = false
        };

        diagnosis._teeth.AddRange(toothList);
        return diagnosis;
    }

    public PatientDiagnosis UpdateTeeth(IEnumerable<ToothSelection> teeth)
    {
        GuardEditable();

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        if (toothList.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection,
                "A diagnosis must cover at least one tooth.");
        }

        GuardNoDuplicateTeeth(toothList);

        _teeth.Clear();
        _teeth.AddRange(toothList);
        return this;
    }

    public PatientDiagnosis UpdateNote(string? note)
    {
        GuardEditable();
        Note = note;
        return this;
    }

    public PatientDiagnosis ChangeStaff(Guid staffId, Guid? secondStaffId)
    {
        GuardEditable();
        StaffId = staffId;
        SecondStaffId = secondStaffId;
        return this;
    }

    /// <summary>Called when a consulting line derived from this diagnosis becomes a treatment service.</summary>
    public PatientDiagnosis MarkTreatmentServiceCreated()
    {
        HasTreatmentService = true;

        if (Status == PatientDiagnosisStatus.Created)
        {
            Status = PatientDiagnosisStatus.InProgress;
        }

        return this;
    }

    public PatientDiagnosis MarkTreated()
    {
        if (Status == PatientDiagnosisStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiagnosisTransition,
                "A cancelled diagnosis cannot be marked as treated.");
        }

        Status = PatientDiagnosisStatus.Treated;
        return this;
    }

    public PatientDiagnosis Cancel()
    {
        if (Status == PatientDiagnosisStatus.Treated)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiagnosisTransition,
                "A treated diagnosis cannot be cancelled.");
        }

        Status = PatientDiagnosisStatus.Cancelled;
        return this;
    }

    private void GuardEditable()
    {
        if (Status is PatientDiagnosisStatus.Treated or PatientDiagnosisStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiagnosisTransition,
                $"A diagnosis in status {Status} can no longer be edited.");
        }
    }

    private static void GuardNoDuplicateTeeth(IReadOnlyCollection<ToothSelection> teeth)
    {
        var duplicate = teeth
            .GroupBy(t => t.ToothCode)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate != null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.DuplicateToothSelection,
                $"Tooth {duplicate.Key} is listed more than once.");
        }
    }
}
