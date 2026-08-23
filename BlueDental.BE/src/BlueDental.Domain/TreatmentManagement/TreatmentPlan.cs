using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Phiếu điều trị — a patient's treatment plan and the service lines it holds.
///
/// The reference calls this <c>patient-treatments</c>: a numbered slip (DT01) that
/// carries a status, a progress percentage, a plan-level discount and a money
/// rollup, plus the <c>treatmentServices[]</c> it is made of. It has **no approval
/// step** — a slip opened from accepted consulting lines starts in progress.
///
/// BlueDental keeps a second, manual path (Draft → PendingApproval → Approved →
/// InProgress) for plans built by hand; that path is BlueDental's own.
/// </summary>
public class TreatmentPlan : FullAuditedAggregateRoot<Guid>
{
    private readonly List<TreatmentService> _services = new();

    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Title { get; private set; } = default!;
    public string? Description { get; private set; }
    public TreatmentPlanStatus Status { get; private set; }
    public DateOnly? EstimatedCompletionDate { get; private set; }
    public string? ApprovalNotes { get; private set; }
    public Guid? ApprovedBy { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }

    /// <summary>Slip number shown in the UI — "DT01", numbered per patient.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Nhân sự tư vấn, separate from the receiving dentist.</summary>
    public Guid? ConsultantStaffId { get; private set; }

    /// <summary>Discount applied to the whole slip, on top of any line discount.</summary>
    public DiscountType DiscountType { get; private set; }

    public decimal DiscountValue { get; private set; }

    public decimal? VoucherDiscountAmount { get; private set; }

    public IReadOnlyCollection<TreatmentService> Services => _services.AsReadOnly();

    /// <summary>Lines that still count — cancelled ones are worth nothing.</summary>
    private IEnumerable<TreatmentService> CountedServices =>
        _services.Where(s => s.Status != TreatmentServiceStatus.Cancelled);

    /// <summary>Sum of the line amounts before the slip-level discount.</summary>
    public decimal ServicesTotal => CountedServices.Sum(s => s.CountedAmount);

    /// <summary>Slip-level discount, capped at the slip total.</summary>
    public decimal PlanDiscountAmount
    {
        get
        {
            var discount = DiscountType switch
            {
                DiscountType.Money => DiscountValue,
                DiscountType.Percentage => ServicesTotal * DiscountValue / 100m,
                _ => 0m
            };

            discount += VoucherDiscountAmount ?? 0m;
            return discount > ServicesTotal ? ServicesTotal : discount;
        }
    }

    /// <summary>What the patient actually owes for this slip.</summary>
    public decimal TotalAmount => ServicesTotal - PlanDiscountAmount;

    /// <summary>Value of the lines already finished — drives Phải thu.</summary>
    public decimal CompletedValue
    {
        get
        {
            if (ServicesTotal == 0m)
            {
                return 0m;
            }

            var completed = CountedServices.Where(s => s.IsCompleted).Sum(s => s.CountedAmount);

            // The slip-level discount is spread across the lines proportionally.
            return completed - (PlanDiscountAmount * completed / ServicesTotal);
        }
    }

    /// <summary>Tiến độ: finished lines over counted lines, 0-100.</summary>
    public int ProgressPercent
    {
        get
        {
            var counted = CountedServices.Count();
            if (counted == 0)
            {
                return 0;
            }

            return CountedServices.Count(s => s.IsCompleted) * 100 / counted;
        }
    }

    protected TreatmentPlan() { }

    public TreatmentPlan(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        string title,
        string? description = null,
        DateOnly? estimatedCompletionDate = null)
        : base(id)
    {
        PatientId = patientId;
        DentistId = dentistId;
        BranchId = branchId;
        Title = title;
        Description = description;
        EstimatedCompletionDate = estimatedCompletionDate;
        Status = TreatmentPlanStatus.Draft;
    }

    /// <summary>
    /// Opens a slip straight from accepted consulting lines, the way the reference
    /// does it — no approval step, in progress from the start.
    /// </summary>
    public static TreatmentPlan Open(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        string code,
        string title,
        Guid? consultantStaffId = null,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Check.NotNullOrWhiteSpace(title, nameof(title));

        return new TreatmentPlan
        {
            Id = id,
            PatientId = patientId,
            DentistId = dentistId,
            BranchId = branchId,
            Code = code,
            Title = title,
            ConsultantStaffId = consultantStaffId,
            DiscountType = discountType,
            DiscountValue = discountValue,
            Status = TreatmentPlanStatus.InProgress
        };
    }

    /// <summary>Pulls one accepted consulting line into the slip as a service line.</summary>
    public TreatmentService AddService(
        Guid serviceLineId,
        Guid serviceId,
        Guid? sourceAdviseId,
        decimal price,
        int quantity,
        DiscountType discountType,
        decimal discountValue,
        IEnumerable<ToothSelection>? teeth = null)
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"No service line can be added to a plan in status {Status}.");
        }

        if (sourceAdviseId.HasValue && _services.Any(s => s.SourceAdviseId == sourceAdviseId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "That consulting line is already on this plan.");
        }

        var line = TreatmentService.FromAdvise(
            serviceLineId,
            Id,
            PatientId,
            BranchId,
            serviceId,
            sourceAdviseId,
            $"{Code}-{_services.Count + 1:D2}",
            price,
            quantity,
            discountType,
            discountValue,
            teeth);

        _services.Add(line);
        return line;
    }

    public TreatmentService GetService(Guid serviceLineId)
    {
        var line = _services.FirstOrDefault(s => s.Id == serviceLineId);
        if (line == null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "That service line does not belong to this plan.");
        }

        return line;
    }

    /// <summary>Applies a discount to the whole slip.</summary>
    public TreatmentPlan ApplyDiscount(DiscountType discountType, decimal discountValue)
    {
        if (discountValue < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "A discount cannot be negative.");
        }

        if (discountType == DiscountType.Percentage && discountValue > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "A percentage discount cannot exceed 100.");
        }

        DiscountType = discountType;
        DiscountValue = discountValue;
        return this;
    }

    /// <summary>Closes the slip once every counted line is finished.</summary>
    public TreatmentPlan CloseIfAllServicesDone()
    {
        if (Status != TreatmentPlanStatus.InProgress)
        {
            return this;
        }

        if (CountedServices.Any() && CountedServices.All(s => s.IsCompleted))
        {
            Status = TreatmentPlanStatus.Completed;
        }

        return this;
    }

    public TreatmentPlan SubmitForApproval()
    {
        EnsureStatus(TreatmentPlanStatus.Draft, nameof(SubmitForApproval));
        Status = TreatmentPlanStatus.PendingApproval;
        return this;
    }

    public TreatmentPlan Approve(Guid approvedBy, string? notes = null)
    {
        EnsureStatus(TreatmentPlanStatus.PendingApproval, nameof(Approve));
        Status = TreatmentPlanStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTimeOffset.UtcNow;
        ApprovalNotes = notes;
        return this;
    }

    public TreatmentPlan Start()
    {
        EnsureStatus(TreatmentPlanStatus.Approved, nameof(Start));
        Status = TreatmentPlanStatus.InProgress;
        return this;
    }

    public TreatmentPlan Complete()
    {
        EnsureStatus(TreatmentPlanStatus.InProgress, nameof(Complete));
        Status = TreatmentPlanStatus.Completed;
        return this;
    }

    public TreatmentPlan Cancel()
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot cancel a treatment plan in status {Status}.");
        }

        Status = TreatmentPlanStatus.Cancelled;
        return this;
    }

    private void EnsureStatus(TreatmentPlanStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot perform '{operation}' on plan with status '{Status}'. Expected '{expected}'.");
        }
    }
}
