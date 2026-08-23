using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One step of a treatment service (Công đoạn).
///
/// OBSERVED on the reference:
/// <list type="bullet">
///   <item>the ability subject <c>treatmentStage</c> with the verbs
///         read, create, update, continue, complete, print;</item>
///   <item>"Thêm công đoạn" sits on every row of the treatment-plan table, so a
///         stage hangs off one treatment service, not off the plan as a whole;</item>
///   <item>CSKH records reference <c>stageIds</c> and carry
///         <c>patientStages[] = { id, serviceId, serviceDetails.isImageRequired }</c>,
///         so a stage knows its service and whether that service demands an image;</item>
///   <item>the treatment summary returns
///         <c>{ treatmentServiceId, treatmentId, treatmentCode, serviceName, stageNote }</c>,
///         so a stage carries a free-text note and the newest one is surfaced;</item>
///   <item>Labo orders have a "Tiếp tục công đoạn" kind, matching the continue verb.</item>
/// </list>
///
/// ASSUMED by BlueDental, because no patient with active stages could be
/// inspected without mutating production (UNKNOWN_REFERENCE_BEHAVIOR):
/// the sequence number, the tooth selection, the started/completed timestamps,
/// and the rule that a service requiring an image cannot have its stage
/// completed until at least one image is attached.
/// </summary>
public class TreatmentStage : FullAuditedAggregateRoot<Guid>
{
    private readonly List<ToothSelection> _teeth = new();
    private readonly List<string> _imageUrls = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>
    /// Treatment plan the service line belongs to (phiếu điều trị). Null while the
    /// consulting line has not been turned into a plan yet.
    /// </summary>
    public Guid? TreatmentId { get; private set; }

    /// <summary>The service line the stage is a step of (dịch vụ điều trị).</summary>
    public Guid TreatmentServiceId { get; private set; }

    /// <summary>Catalog service behind that line — kept for the image rule.</summary>
    public Guid ServiceId { get; private set; }

    /// <summary>1-based position of this stage within its service.</summary>
    public int SequenceNumber { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Free-text step description — the reference's <c>stageNote</c>.</summary>
    public string? Note { get; private set; }

    /// <summary>Dentist performing the step.</summary>
    public Guid StaffId { get; private set; }

    /// <summary>Optional assistant (bác sĩ hỗ trợ / trợ thủ).</summary>
    public Guid? SecondStaffId { get; private set; }

    public DateOnly? ScheduledDate { get; private set; }

    public TreatmentStageStatus Status { get; private set; }

    /// <summary>Copied from the service at creation: the step needs a photo to close.</summary>
    public bool IsImageRequired { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Teeth this step works on. Optional — some steps are not tooth-specific.</summary>
    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();

    /// <summary>Clinical photos attached to the step (stored as links, never binaries).</summary>
    public IReadOnlyCollection<string> ImageUrls => _imageUrls.AsReadOnly();

    protected TreatmentStage() { }

    public static TreatmentStage Add(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        Guid? treatmentId,
        Guid treatmentServiceId,
        Guid serviceId,
        int sequenceNumber,
        string name,
        Guid staffId,
        string? note = null,
        DateOnly? scheduledDate = null,
        bool isImageRequired = false,
        IEnumerable<ToothSelection>? teeth = null,
        Guid? secondStaffId = null)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (sequenceNumber < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageSequence,
                "A stage sequence number starts at 1.");
        }

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        GuardNoDuplicateTeeth(toothList);

        var stage = new TreatmentStage
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            TreatmentId = treatmentId,
            TreatmentServiceId = treatmentServiceId,
            ServiceId = serviceId,
            SequenceNumber = sequenceNumber,
            Name = name.Trim(),
            Note = note,
            StaffId = staffId,
            SecondStaffId = secondStaffId,
            ScheduledDate = scheduledDate,
            IsImageRequired = isImageRequired,
            Status = TreatmentStageStatus.Pending
        };

        stage._teeth.AddRange(toothList);
        return stage;
    }

    public TreatmentStage UpdateDetails(
        string name,
        string? note,
        DateOnly? scheduledDate,
        Guid staffId,
        Guid? secondStaffId,
        IEnumerable<ToothSelection>? teeth)
    {
        GuardEditable();
        Check.NotNullOrWhiteSpace(name, nameof(name));

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        GuardNoDuplicateTeeth(toothList);

        Name = name.Trim();
        Note = note;
        ScheduledDate = scheduledDate;
        StaffId = staffId;
        SecondStaffId = secondStaffId;

        _teeth.Clear();
        _teeth.AddRange(toothList);
        return this;
    }

    /// <summary>Tiếp tục công đoạn — work on the step. Re-entrant: the start time is kept.</summary>
    public TreatmentStage Continue()
    {
        if (Status == TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "A completed stage cannot be continued.");
        }

        Status = TreatmentStageStatus.InProgress;
        StartedAt ??= DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>
    /// Close the step. Allowed straight from Pending, because continue and complete
    /// are separate abilities on the reference and a user may hold only the latter.
    /// </summary>
    public TreatmentStage Complete()
    {
        if (Status == TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "The stage is already completed.");
        }

        if (IsImageRequired && _imageUrls.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.StageImageRequired,
                "This service requires a clinical image before the stage can be completed.");
        }

        Status = TreatmentStageStatus.Completed;
        StartedAt ??= DateTimeOffset.UtcNow;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public TreatmentStage AttachImage(string imageUrl)
    {
        GuardEditable();
        Check.NotNullOrWhiteSpace(imageUrl, nameof(imageUrl));

        var url = imageUrl.Trim();
        if (!_imageUrls.Contains(url))
        {
            _imageUrls.Add(url);
        }

        return this;
    }

    public TreatmentStage RemoveImage(string imageUrl)
    {
        GuardEditable();
        _imageUrls.Remove(imageUrl);
        return this;
    }

    private void GuardEditable()
    {
        if (Status == TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "A completed stage can no longer be edited.");
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
