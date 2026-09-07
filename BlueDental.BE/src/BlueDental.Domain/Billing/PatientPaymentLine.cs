using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Billing;

/// <summary>
/// One service line's share of a receipt.
///
/// The reference collects money as a single "phiếu thanh toán" naming every
/// service it covers (<c>treatmentServiceIds[]</c>), and — when the cashier
/// splits by hand — how much of the total goes to each (<c>items[]</c>). A
/// receipt therefore has lines rather than one service of its own.
/// </summary>
public class PatientPaymentLine : Entity<Guid>
{
    /// <summary>Set by EF from the receipt's collection.</summary>
    public Guid PatientPaymentId { get; private set; }

    public Guid TreatmentServiceId { get; private set; }

    /// <summary>This line's share of the receipt total, always above zero.</summary>
    public decimal Amount { get; private set; }

    protected PatientPaymentLine() { }

    internal PatientPaymentLine(Guid id, Guid treatmentServiceId, decimal amount)
        : base(id)
    {
        if (treatmentServiceId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt line must name the service it pays for.");
        }

        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt line must be greater than zero.");
        }

        TreatmentServiceId = treatmentServiceId;
        Amount = amount;
    }
}
