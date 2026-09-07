using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tái khám — a follow-up visit raised from a finished công đoạn.
///
/// OBSERVED on the reference 2026-09-07: its patient timeline returns two kinds
/// of row, <c>type: "stage"</c> and <c>type: "re_examination"</c>, and a tái
/// khám is the second — a row of its own carrying code <c>REX001</c>, not
/// another công đoạn. Its payload holds
/// <c>{ code, patientStageId, patientStage, treatmentServiceDetails, serviceId,
/// staffId, subStaffId, assistantStaffId, note, content, selectedContent,
/// images, dateTime }</c>, and the source stage flips <c>hasReExamination</c>.
///
/// The reference keeps two tooth lists: <c>content</c>, copied from the source
/// stage, and <c>selectedContent</c> — the codes actually ticked in the form.
/// Only the second is shown on the row, and the first is just the source's own
/// list, so BlueDental stores the **chosen** teeth here and reads the candidates
/// off the source stage when the form opens.
///
/// It carries no status, no quantity and no care record: the reference leaves
/// the row's Công đoạn and Chăm sóc sau điều trị cells empty.
/// </summary>
public class PatientReExamination : FullAuditedAggregateRoot<Guid>
{
    private readonly List<ToothSelection> _teeth = new();
    private readonly List<string> _imageUrls = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>REX001, REX002, … running per patient, as DT does for a slip.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>The finished công đoạn this follow-up was raised from.</summary>
    public Guid PatientStageId { get; private set; }

    /// <summary>The service line that stage belongs to, kept for the row's SL.</summary>
    public Guid TreatmentServiceId { get; private set; }

    /// <summary>Catalog service behind the line — the row prints its name.</summary>
    public Guid ServiceId { get; private set; }

    public Guid StaffId { get; private set; }

    /// <summary>Phụ tá — the reference's <c>subStaffId</c>.</summary>
    public Guid? SubStaffId { get; private set; }

    /// <summary>Bác sĩ hỗ trợ — the reference's <c>assistantStaffId</c>.</summary>
    public Guid? SecondStaffId { get; private set; }

    /// <summary>Nội dung điều trị.</summary>
    public string? Note { get; private set; }

    /// <summary>The teeth ticked in the form — the reference's selectedContent.</summary>
    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();

    public IReadOnlyCollection<string> ImageUrls => _imageUrls.AsReadOnly();

    protected PatientReExamination() { }

    public static PatientReExamination Raise(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string code,
        Guid patientStageId,
        Guid treatmentServiceId,
        Guid serviceId,
        Guid staffId,
        string? note = null,
        IEnumerable<ToothSelection>? teeth = null,
        Guid? subStaffId = null,
        Guid? secondStaffId = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        var chosen = teeth?.ToList() ?? new List<ToothSelection>();
        if (chosen.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection,
                "A follow-up visit needs at least one tooth chosen.");
        }

        if (chosen.Select(x => x.ToothCode).Distinct().Count() != chosen.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.DuplicateToothSelection,
                "The same tooth cannot be chosen twice.");
        }

        var visit = new PatientReExamination
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Code = code.Trim(),
            PatientStageId = patientStageId,
            TreatmentServiceId = treatmentServiceId,
            ServiceId = serviceId,
            StaffId = staffId,
            SubStaffId = subStaffId,
            SecondStaffId = secondStaffId,
            Note = note,
        };

        visit._teeth.AddRange(chosen);
        return visit;
    }

    public PatientReExamination AttachImage(string imageUrl)
    {
        Check.NotNullOrWhiteSpace(imageUrl, nameof(imageUrl));

        var url = imageUrl.Trim();
        if (!_imageUrls.Contains(url))
        {
            _imageUrls.Add(url);
        }

        return this;
    }
}
