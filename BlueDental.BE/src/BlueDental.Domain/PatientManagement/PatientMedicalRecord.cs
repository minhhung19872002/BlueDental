using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// One sheet of a patient's Bệnh án — "phiếu bệnh án".
///
/// The reference keeps these per patient behind
/// <c>GET /patient-medical-record/files/{patientId}</c> and calls each one a
/// *file*: the clinic picks a form out of "Mục lục bệnh án", presses "Thêm",
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

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Which of the printed forms this sheet is — see MedicalRecordForm.</summary>
    public MedicalRecordForm Form { get; private set; }

    /// <summary>What the index called it when it was added, kept for the tab strip.</summary>
    public string Title { get; private set; } = string.Empty;

    /// <summary>Order within the patient's own stack of sheets.</summary>
    public int SortOrder { get; private set; }

    /// <summary>The filled cells, as JSON. Empty until the clinic writes on it.</summary>
    public string? Content { get; private set; }

    protected PatientMedicalRecord() { }

    public static PatientMedicalRecord Add(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
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
            Form = form,
            Title = title.Trim(),
            SortOrder = sortOrder,
        };
    }

    /// <summary>
    /// Saves what the clinic has written. A sheet is never "submitted" — it is
    /// worked on across visits — so there is no status to guard here.
    /// </summary>
    public PatientMedicalRecord Fill(string? content)
    {
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
        Check.NotNullOrWhiteSpace(title, nameof(title));
        Title = title.Trim();
        return this;
    }

    public PatientMedicalRecord MoveTo(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }
}
