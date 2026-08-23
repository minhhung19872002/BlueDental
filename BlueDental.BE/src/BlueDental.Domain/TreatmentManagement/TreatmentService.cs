using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One service line inside a treatment plan (Dịch vụ điều trị).
///
/// Observed on the reference as `treatmentServices[]`, carrying its own money and
/// its own status:
/// <c>{ id, code, price, quantity, status, effectiveAmount, payment{...}, service{...} }</c>.
///
/// A line is created by pulling an accepted consulting line (`PatientAdvise`) into
/// a plan, which is why it keeps a pointer back to the advise it came from.
/// Công đoạn (<see cref="TreatmentStage"/>) hang off this line, not off the plan.
/// </summary>
public class TreatmentService : FullAuditedEntity<Guid>
{
    private readonly List<ToothSelection> _teeth = new();

    public Guid TreatmentPlanId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Catalog service being delivered.</summary>
    public Guid ServiceId { get; private set; }

    /// <summary>The consulting line this was pulled from.</summary>
    public Guid? SourceAdviseId { get; private set; }

    /// <summary>Line code shown in the UI, unique inside its plan.</summary>
    public string Code { get; private set; } = string.Empty;

    public decimal Price { get; private set; }
    public int Quantity { get; private set; }
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }

    public TreatmentServiceStatus Status { get; private set; }

    /// <summary>Teeth this line treats, inherited from the consulting line.</summary>
    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();

    public decimal GrossAmount => Price * Quantity;

    public decimal DiscountAmount
    {
        get
        {
            var discount = DiscountType switch
            {
                DiscountType.Money => DiscountValue,
                DiscountType.Percentage => GrossAmount * DiscountValue / 100m,
                _ => 0m
            };

            return discount > GrossAmount ? GrossAmount : discount;
        }
    }

    public decimal EffectiveAmount => GrossAmount - DiscountAmount;

    /// <summary>A cancelled line is worth nothing, however it was priced.</summary>
    public decimal CountedAmount =>
        Status == TreatmentServiceStatus.Cancelled ? 0m : EffectiveAmount;

    /// <summary>Only a finished line counts as value delivered to the patient.</summary>
    public bool IsCompleted => Status == TreatmentServiceStatus.Done;

    protected TreatmentService() { }

    public static TreatmentService FromAdvise(
        Guid id,
        Guid treatmentPlanId,
        Guid patientId,
        Guid clinicBranchId,
        Guid serviceId,
        Guid? sourceAdviseId,
        string code,
        decimal price,
        int quantity,
        DiscountType discountType,
        decimal discountValue,
        IEnumerable<ToothSelection>? teeth = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        if (price < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.NegativePaymentAmount,
                "A service line cannot be priced below zero.");
        }

        if (quantity < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseQuantity,
                "A service line needs at least one unit.");
        }

        var line = new TreatmentService
        {
            Id = id,
            TreatmentPlanId = treatmentPlanId,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            ServiceId = serviceId,
            SourceAdviseId = sourceAdviseId,
            Code = code,
            Price = price,
            Quantity = quantity,
            DiscountType = discountType,
            DiscountValue = discountValue,
            Status = TreatmentServiceStatus.Created
        };

        line._teeth.AddRange(teeth?.ToList() ?? new List<ToothSelection>());
        return line;
    }

    /// <summary>Work has started on this line — the first công đoạn moved it.</summary>
    public TreatmentService Start()
    {
        GuardOpen();

        if (Status == TreatmentServiceStatus.Created)
        {
            Status = TreatmentServiceStatus.InProgress;
        }

        return this;
    }

    public TreatmentService Complete()
    {
        GuardOpen();
        Status = TreatmentServiceStatus.Done;
        return this;
    }

    public TreatmentService Cancel()
    {
        if (Status == TreatmentServiceStatus.Done)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                "A finished service line cannot be cancelled.");
        }

        Status = TreatmentServiceStatus.Cancelled;
        return this;
    }

    private void GuardOpen()
    {
        if (Status is TreatmentServiceStatus.Done or TreatmentServiceStatus.Cancelled
            or TreatmentServiceStatus.Replaced)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"A service line in status {Status} is closed.");
        }
    }
}
