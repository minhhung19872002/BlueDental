using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// A priced consulting line offered to a patient for one service on one set of
/// teeth (Tư vấn).
///
/// Reference: <c>GET /api/v1/patient-advises</c>. Advises are the priced bridge
/// between a <see cref="PatientDiagnosis"/> and a <see cref="TreatmentPlan"/>.
/// </summary>
public class PatientAdvise : FullAuditedAggregateRoot<Guid>
{
    private readonly List<ToothSelection> _teeth = new();
    private readonly List<Guid> _imageIds = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Service being offered (Danh mục dịch vụ).</summary>
    public Guid ServiceId { get; private set; }

    /// <summary>Diagnosis catalog entry this advise answers.</summary>
    public Guid DiagnosisId { get; private set; }

    /// <summary>The patient-specific diagnosis this advise was raised from.</summary>
    public Guid PatientDiagnosisId { get; private set; }

    /// <summary>Set once the advise has been pulled into a treatment plan.</summary>
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>Optional grouping bucket (Nhóm tư vấn).</summary>
    public Guid? AdviseGroupId { get; private set; }

    public Guid StaffId { get; private set; }
    public Guid? SecondStaffId { get; private set; }

    public string Code { get; private set; } = string.Empty;
    public string? Note { get; private set; }

    /// <summary>Catalog list price at the time of consulting.</summary>
    public decimal OriginalPrice { get; private set; }

    /// <summary>Agreed unit price (may differ from <see cref="OriginalPrice"/>).</summary>
    public decimal Price { get; private set; }

    public int Quantity { get; private set; }

    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }

    /// <summary>Discount contributed by an applied voucher, when any.</summary>
    public decimal? VoucherDiscountAmount { get; private set; }

    public PatientAdviseStatus Status { get; private set; }

    /// <summary>Display order inside the consulting tab (reference: <c>sortOrder</c>).</summary>
    public int SortOrder { get; private set; }

    public IReadOnlyCollection<ToothSelection> Teeth => _teeth.AsReadOnly();
    public IReadOnlyCollection<Guid> ImageIds => _imageIds.AsReadOnly();

    /// <summary>Line total before discount.</summary>
    public decimal GrossAmount => Price * Quantity;

    /// <summary>Discount resolved into an absolute amount.</summary>
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

            discount += VoucherDiscountAmount ?? 0m;
            return discount > GrossAmount ? GrossAmount : discount;
        }
    }

    /// <summary>Amount the patient is expected to pay for this line.</summary>
    public decimal EffectiveAmount => GrossAmount - DiscountAmount;

    protected PatientAdvise() { }

    public static PatientAdvise Offer(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        Guid patientDiagnosisId,
        Guid diagnosisId,
        Guid serviceId,
        Guid staffId,
        string code,
        decimal originalPrice,
        decimal price,
        int quantity,
        IEnumerable<ToothSelection> teeth,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m,
        int sortOrder = 0,
        string? note = null,
        Guid? secondStaffId = null,
        Guid? adviseGroupId = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        if (quantity <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseQuantity,
                "Advise quantity must be greater than zero.");
        }

        if (price < 0m || originalPrice < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.NegativePaymentAmount,
                "Advise prices must not be negative.");
        }

        var toothList = teeth?.ToList() ?? new List<ToothSelection>();
        if (toothList.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection,
                "An advise must cover at least one tooth.");
        }

        var advise = new PatientAdvise
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            PatientDiagnosisId = patientDiagnosisId,
            DiagnosisId = diagnosisId,
            ServiceId = serviceId,
            StaffId = staffId,
            SecondStaffId = secondStaffId,
            AdviseGroupId = adviseGroupId,
            Code = code,
            OriginalPrice = originalPrice,
            Price = price,
            Quantity = quantity,
            SortOrder = sortOrder,
            Note = note,
            Status = PatientAdviseStatus.Created
        };

        advise.ApplyDiscount(discountType, discountValue);
        advise._teeth.AddRange(toothList);
        return advise;
    }

    public PatientAdvise ApplyDiscount(DiscountType discountType, decimal discountValue)
    {
        GuardEditable();

        if (discountValue < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Discount value must not be negative.");
        }

        if (discountType == DiscountType.Percentage && discountValue > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Percentage discount must not exceed 100.");
        }

        if (discountType == DiscountType.Money && discountValue > GrossAmount)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Money discount must not exceed the line total.");
        }

        if (discountType == DiscountType.None && discountValue != 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Discount value must be zero when no discount type is set.");
        }

        DiscountType = discountType;
        DiscountValue = discountValue;
        return this;
    }

    public PatientAdvise ApplyVoucher(decimal voucherDiscountAmount)
    {
        GuardEditable();

        if (voucherDiscountAmount < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Voucher discount must not be negative.");
        }

        VoucherDiscountAmount = voucherDiscountAmount;
        return this;
    }

    public PatientAdvise ChangePricing(decimal price, int quantity)
    {
        GuardEditable();

        if (quantity <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseQuantity,
                "Advise quantity must be greater than zero.");
        }

        if (price < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.NegativePaymentAmount,
                "Advise price must not be negative.");
        }

        Price = price;
        Quantity = quantity;
        return this;
    }

    public PatientAdvise MoveToGroup(Guid? adviseGroupId)
    {
        GuardEditable();
        AdviseGroupId = adviseGroupId;
        return this;
    }

    public PatientAdvise Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    public PatientAdvise AttachImage(Guid imageId)
    {
        if (!_imageIds.Contains(imageId))
        {
            _imageIds.Add(imageId);
        }

        return this;
    }

    public PatientAdvise DetachImage(Guid imageId)
    {
        _imageIds.Remove(imageId);
        return this;
    }

    public PatientAdvise Accept()
    {
        if (Status != PatientAdviseStatus.Created)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                $"Only a newly created advise can be accepted (current: {Status}).");
        }

        Status = PatientAdviseStatus.Accepted;
        return this;
    }

    public PatientAdvise Reject()
    {
        if (Status is PatientAdviseStatus.Converted or PatientAdviseStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                $"An advise in status {Status} can no longer be rejected.");
        }

        Status = PatientAdviseStatus.Rejected;
        return this;
    }

    /// <summary>Pulls this advise into a treatment plan; the line becomes immutable.</summary>
    public PatientAdvise ConvertTo(Guid treatmentPlanId)
    {
        if (Status is PatientAdviseStatus.Rejected or PatientAdviseStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                $"An advise in status {Status} cannot be converted into a treatment plan.");
        }

        if (Status == PatientAdviseStatus.Converted)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "This advise has already been converted.");
        }

        TreatmentPlanId = treatmentPlanId;
        Status = PatientAdviseStatus.Converted;
        return this;
    }

    public PatientAdvise Cancel()
    {
        if (Status == PatientAdviseStatus.Converted)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A converted advise cannot be cancelled; cancel the treatment service instead.");
        }

        Status = PatientAdviseStatus.Cancelled;
        return this;
    }

    private void GuardEditable()
    {
        if (Status is PatientAdviseStatus.Converted or PatientAdviseStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                $"An advise in status {Status} can no longer be edited.");
        }
    }
}
