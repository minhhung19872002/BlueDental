using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// One sheet of a patient's Bệnh án — "BE:Common:MedRecordSlips".
///
/// The reference keeps these per patient behind
/// <c>GET /patient-medical-record/files/{patientId}</c> and calls each one a
/// *file*: the clinic picks a form out of "BE:Treatment:MedRecordTOC", presses "BE:Common:Add",
/// and gets a fresh sheet to fill in. Several sheets of the same form may exist
/// for one patient, which is why the form is a field here rather than the key.
///
/// The filled cells travel as JSON in <see cref="Content"/>. The sheet's layout
/// is printed, not stored: only what the clinic writes is data, so a change to
/// the printed form never has to migrate anyone's records.
/// </summary>
public class PatientMedicalRecord : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Guards a runaway paste; a filled sheet is a few kilobytes.</summary>
    public const int MaxContentLength = 200_000;

    public const int MaxCancelReasonLength = 1000;

    /// <summary>Guards a runaway pick; a bộ hồ sơ holds a few dozen services at most.</summary>
    public const int MaxServiceCount = 200;

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The bộ hồ sơ bệnh án the sheet was added to — see MedicalRecordSet.</summary>
    public Guid RecordSetId { get; private set; }

    /// <summary>Which of the printed forms this sheet is — see MedicalRecordForm.</summary>
    public MedicalRecordForm Form { get; private set; }

    /// <summary>What the index called it when it was added, kept for the tab strip.</summary>
    public string Title { get; private set; } = string.Empty;

    /// <summary>Order within the patient's own stack of sheets.</summary>
    public int SortOrder { get; private set; }

    /// <summary>The filled cells, as JSON. Empty until the clinic writes on it.</summary>
    public string? Content { get; private set; }

    /// <summary>
    /// "Hủy phiếu": the sheet is never erased. It stays in the index marked
    /// Đã hủy, with who cancelled it, when, and why, and can no longer change.
    /// </summary>
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledById { get; private set; }
    public string? CancelReason { get; private set; }

    public bool IsCancelled => CancelledAt.HasValue;

    /// <summary>
    /// Phiếu tư vấn và xác nhận đồng ý điều trị (mẫu 5) only: the lines of the
    /// set's treatment slips this copy is about — Bản 01 the braces package, Bản 02
    /// a later service (R-1326). Null on a copy made before a pick existed: it
    /// prints every service of the set, as it always did, until one is picked.
    /// </summary>
    public List<Guid>? ServiceIds { get; private set; }

    protected PatientMedicalRecord() { }

    public static PatientMedicalRecord Add(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        Guid recordSetId,
        MedicalRecordForm form,
        string title,
        int sortOrder)
    {
        Check.NotNullOrWhiteSpace(title, nameof(title));

        return new PatientMedicalRecord
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            RecordSetId = recordSetId,
            Form = form,
            Title = title.Trim(),
            SortOrder = sortOrder,
        };
    }

    /// <summary>
    /// Saves what the clinic has written. A sheet is never "submitted" — it is
    /// worked on across visits — so the only state that stops it is Đã hủy.
    /// </summary>
    public PatientMedicalRecord Fill(string? content)
    {
        EnsureNotCancelled();

        if (content is not null && content.Length > MaxContentLength)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordTooLarge,
                "The medical record sheet is too large to store.");
        }

        Content = content;
        return this;
    }

    public PatientMedicalRecord Rename(string title)
    {
        EnsureNotCancelled();
        Check.NotNullOrWhiteSpace(title, nameof(title));
        Title = title.Trim();
        return this;
    }

    /// <summary>
    /// "Dịch vụ của phiếu": which of the set's service lines this mẫu 5 copy
    /// prints. The caller checks the ids are lines of the set's slips.
    /// </summary>
    public PatientMedicalRecord PickServices(IEnumerable<Guid> serviceIds)
    {
        EnsureNotCancelled();

        if (Form != MedicalRecordForm.TreatmentConsent)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordServicesNotPickable);
        }

        var picked = serviceIds.Distinct().ToList();
        if (picked.Count > MaxServiceCount)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordServiceNotInSet);
        }

        ServiceIds = picked;
        return this;
    }

    public PatientMedicalRecord MoveTo(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    public PatientMedicalRecord Cancel(string? reason, DateTime cancelledAt, Guid? cancelledById)
    {
        EnsureNotCancelled();

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordCancelReasonRequired);
        }

        CancelReason = Check.Length(reason.Trim(), nameof(reason), MaxCancelReasonLength);
        CancelledAt = cancelledAt;
        CancelledById = cancelledById;
        return this;
    }

    public void EnsureNotCancelled()
    {
        if (IsCancelled)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSheetCancelled);
        }
    }
}
