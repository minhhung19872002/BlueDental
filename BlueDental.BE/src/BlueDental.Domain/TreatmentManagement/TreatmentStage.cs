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
///   <item>"BE:Treatment:AddStage" sits on every row of the treatment-plan table, so a
///         stage hangs off one treatment service, not off the plan as a whole;</item>
///   <item>CSKH records reference <c>stageIds</c> and carry
///         <c>patientStages[] = { id, serviceId, serviceDetails.isImageRequired }</c>,
///         so a stage knows its service and whether that service demands an image;</item>
///   <item>the treatment summary returns
///         <c>{ treatmentServiceId, treatmentId, treatmentCode, serviceName, stageNote }</c>,
///         so a stage carries a free-text note and the newest one is surfaced;</item>
///   <item>Labo orders have a "BE:Treatment:ResumeStage" kind, matching the continue verb.</item>
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
    private readonly List<StageServiceItem> _serviceItems = new();

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

    /// <summary>
    /// Bác sĩ hỗ trợ — the reference's <c>assistantStaffId</c>. A second dentist
    /// standing in on the step.
    /// </summary>
    public Guid? SecondStaffId { get; private set; }

    /// <summary>
    /// Phụ tá — the reference's <c>subStaffId</c>. The nurse assisting, which is a
    /// different slot from the second dentist above.
    /// </summary>
    public Guid? SubStaffId { get; private set; }

    public DateOnly? ScheduledDate { get; private set; }

    public TreatmentStageStatus Status { get; private set; }

    /// <summary>Copied from the service at creation: the step needs a photo to close.</summary>
    public bool IsImageRequired { get; private set; }

    /// <summary>
    /// Bảo hành — the reference's <c>isGuarantee</c>. A warranty visit is a công
    /// đoạn like any other; only this flag and the Bảo hành filter tell it apart.
    /// </summary>
    public bool IsGuarantee { get; private set; }

    /// <summary>
    /// Whether a tái khám has been raised from this công đoạn — the reference's
    /// own <c>hasReExamination</c>, which it carries on the **source** stage.
    /// The follow-up itself is a <see cref="PatientReExamination"/>, a row of its
    /// own on the timeline, not another công đoạn.
    /// </summary>
    public bool HasReExamination { get; private set; }

    /// <summary>Called when a follow-up visit is raised from this step.</summary>
    public TreatmentStage MarkReExamined()
    {
        HasReExamination = true;
        return this;
    }

    /// <summary>
    /// The công đoạn this one carries forward — "Tiếp tục công đoạn" writes a new
    /// row rather than moving the old one. Null on the first công đoạn of a chain.
    /// </summary>
    public Guid? ContinuedFromId { get; private set; }

    /// <summary>
    /// Set once a later công đoạn continues this one — the reference's
    /// <c>disabled</c>. Measured on staging 2026-09-24: after
    /// <c>POST patient-stages/{id}/continue</c> the old row comes back
    /// <c>disabled: true</c> with its own status still <c>created</c>, and the
    /// history greys it out. A superseded công đoạn is history: it cannot be
    /// ticked, re-opened or continued again.
    /// </summary>
    public bool IsSuperseded { get; private set; }

    /// <summary>
    /// For a warranty công đoạn: the ordinary công đoạn its warranty descends
    /// from. A second warranty raised off a finished warranty still offers the
    /// teeth of this root, not the narrower set the last warranty took — the
    /// project owner's rule, and what staging shows when the root covers the
    /// whole line (docs/clone/pages/patient-detail.md, "Bảo hành").
    /// Null on ordinary công đoạn and on warranties written before it existed.
    /// </summary>
    public Guid? WarrantyRootStageId { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Teeth this step works on. Optional — some steps are not tooth-specific.</summary>
    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();

    /// <summary>Clinical photos attached to the step (stored as links, never binaries).</summary>
    public IReadOnlyCollection<string> ImageUrls => _imageUrls.AsReadOnly();

    /// <summary>
    /// "BE:Treatment:StageList" — which of the service's own steps this công đoạn
    /// covers, and which of those are done. See <see cref="StageServiceItem"/>.
    /// </summary>
    public IReadOnlyCollection<StageServiceItem> ServiceItems => _serviceItems.AsReadOnly();

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
        Guid? secondStaffId = null,
        Guid? subStaffId = null,
        bool isGuarantee = false,
        IEnumerable<Guid>? serviceItemIds = null,
        Guid? continuedFromId = null,
        Guid? warrantyRootStageId = null)
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
            SubStaffId = subStaffId,
            ScheduledDate = scheduledDate,
            IsImageRequired = isImageRequired,
            IsGuarantee = isGuarantee,
            ContinuedFromId = continuedFromId,
            WarrantyRootStageId = isGuarantee ? warrantyRootStageId : null,
            Status = TreatmentStageStatus.Pending
        };

        stage._teeth.AddRange(toothList);
        stage.SetServiceItems(serviceItemIds ?? []);
        return stage;
    }

    /// <summary>
    /// "Tiếp tục công đoạn" / "Tiếp tục bảo hành": writes the next công đoạn of
    /// this chain and retires this one.
    ///
    /// Measured on staging 2026-09-24: the continuation keeps the teeth — the
    /// form locks them, and the reference refuses a continue whose teeth differ
    /// ("Khi tiếp tục công đoạn, phải chọn đầy đủ các răng của công đoạn hiện
    /// tại") — and a warranty continues as a warranty. Who worked it, the note
    /// and the steps are the new visit's own.
    /// </summary>
    public TreatmentStage ContinueAs(
        Guid id,
        int sequenceNumber,
        Guid staffId,
        string? note,
        Guid? secondStaffId,
        Guid? subStaffId,
        IEnumerable<Guid>? serviceItemIds)
    {
        GuardLive();

        if (Status == TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "A completed stage cannot be continued.");
        }

        var next = Add(
            id,
            PatientId,
            ClinicBranchId,
            TreatmentId,
            TreatmentServiceId,
            ServiceId,
            sequenceNumber,
            Name,
            staffId,
            note,
            scheduledDate: null,
            IsImageRequired,
            // Copies, not the same instances: a tooth is owned by one công
            // đoạn, and EF refuses to hand an owned row to a second owner.
            _teeth.Select(t => new ToothSelection(
                t.ToothCode, t.Selected, t.Top, t.Right, t.Bottom, t.Left, t.Center)),
            secondStaffId,
            subStaffId,
            IsGuarantee,
            serviceItemIds,
            continuedFromId: Id,
            warrantyRootStageId: WarrantyRootStageId);

        IsSuperseded = true;
        return next;
    }

    /// <summary>
    /// The service steps this công đoạn covers, as chosen on the form. All start
    /// unticked: the reference opens every box empty and they are ticked off
    /// afterwards, from the history row.
    /// </summary>
    public TreatmentStage SetServiceItems(IEnumerable<Guid> catalogServiceStageIds)
    {
        var ids = catalogServiceStageIds.Distinct().ToList();
        _serviceItems.Clear();
        _serviceItems.AddRange(ids.Select(id => new StageServiceItem(id)));
        return this;
    }

    /// <summary>
    /// Ticks or unticks the steps named in <paramref name="completedByStageId"/>,
    /// which is the whole picture for this công đoạn — anything left out is
    /// unticked. Steps this công đoạn does not cover are refused rather than
    /// quietly added: the list is fixed when the công đoạn is created.
    /// </summary>
    public TreatmentStage UpdateServiceItems(
        IReadOnlyDictionary<Guid, bool> completedByStageId,
        DateTimeOffset now,
        Guid? staffId)
    {
        GuardLive();

        foreach (var id in completedByStageId.Keys)
        {
            if (!_serviceItems.Exists(item => item.CatalogServiceStageId == id))
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.TreatmentManagement.UnknownStageServiceItem,
                    "That step does not belong to this công đoạn.");
            }
        }

        for (var index = 0; index < _serviceItems.Count; index++)
        {
            var item = _serviceItems[index];
            var wanted = completedByStageId.TryGetValue(item.CatalogServiceStageId, out var value)
                && value;
            _serviceItems[index] = item.With(wanted, now, staffId);
        }

        return this;
    }

    public TreatmentStage UpdateDetails(
        string name,
        string? note,
        DateOnly? scheduledDate,
        Guid staffId,
        Guid? secondStaffId,
        Guid? subStaffId,
        IEnumerable<ToothSelection>? teeth)
    {
        GuardEditable();
        GuardLive();
        Check.NotNullOrWhiteSpace(name, nameof(name));

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        GuardNoDuplicateTeeth(toothList);

        Name = name.Trim();
        Note = note;
        ScheduledDate = scheduledDate;
        StaffId = staffId;
        SecondStaffId = secondStaffId;
        SubStaffId = subStaffId;

        _teeth.Clear();
        _teeth.AddRange(toothList);
        return this;
    }

    /// <summary>
    /// Work has begun on the step. Re-entrant: the start time is kept.
    ///
    /// This used to be called <c>Continue</c> and sat behind
    /// <c>POST …/continue</c>; that route now writes the next công đoạn of the
    /// chain (<see cref="ContinueAs"/>), which is what the reference's continue
    /// does.
    /// </summary>
    public TreatmentStage Start()
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
    ///
    /// <para>
    /// <see cref="IsImageRequired"/> does <b>not</b> gate this. It used to: the
    /// original commit assumed a service carrying "BE:ServiceConfig:RequireImage"
    /// would refuse completion until a picture was attached, and said so as a
    /// stated assumption rather than an observation. The project owner then
    /// checked the reference and reported that Hoàn thành ticks with no image at
    /// all, so the guard was invented and is gone. The flag is still recorded on
    /// the stage because it is the catalog's own, but what the reference actually
    /// does with it is UNKNOWN_REFERENCE_BEHAVIOR — see docs/clone/unknowns.md.
    /// Do not re-add a block here without an observation to back it.
    /// </para>
    /// </summary>
    public TreatmentStage Complete()
    {
        GuardLive();

        if (Status == TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "The stage is already completed.");
        }

        Status = TreatmentStageStatus.Completed;
        StartedAt ??= DateTimeOffset.UtcNow;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>
    /// Re-open a closed step — the reference's <c>revert-status</c>, which is how
    /// un-ticking its Hoàn thành box works, so completion is not final.
    ///
    /// The step returns to InProgress rather than Pending: the visit did happen,
    /// it simply is not finished. Nothing records what the status was before, and
    /// no caller asks for more than "is this step closed".
    /// </summary>
    public TreatmentStage Revert()
    {
        GuardLive();

        if (Status != TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "Only a completed stage can be re-opened.");
        }

        Status = TreatmentStageStatus.InProgress;
        CompletedAt = null;
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

    /// <summary>
    /// A superseded công đoạn is history — its successor is the one being worked.
    /// </summary>
    private void GuardLive()
    {
        if (IsSuperseded)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "This stage has been continued; work on the newer one.");
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
