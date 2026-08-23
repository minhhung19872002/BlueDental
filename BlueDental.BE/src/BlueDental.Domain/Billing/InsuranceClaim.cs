using System;
using BlueDental.Billing.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Billing;

/// <summary>
/// Insurance claim aggregate root.
/// Tracks the submission and adjudication of an insurance claim linked to an invoice.
/// </summary>
public class InsuranceClaim : FullAuditedAggregateRoot<Guid>
{
    public Guid BranchId { get; private set; }
    public Guid InvoiceId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid InsurancePlanId { get; private set; }
    public string ClaimReference { get; private set; } = default!;
    public Money ClaimedAmount { get; private set; } = default!;
    public Money? ApprovedAmount { get; private set; }
    public InsuranceClaimStatus Status { get; private set; }
    public DateTimeOffset? SubmittedAt { get; private set; }
    public DateTimeOffset? SettledAt { get; private set; }
    public string? RejectionReason { get; private set; }
    public string? Notes { get; private set; }

    protected InsuranceClaim() { }

    public InsuranceClaim(
        Guid id,
        Guid invoiceId,
        Guid patientId,
        Guid insurancePlanId,
        string claimReference,
        Money claimedAmount,
        Guid branchId)
        : base(id)
    {
        BranchId = branchId;
        InvoiceId = invoiceId;
        PatientId = patientId;
        InsurancePlanId = insurancePlanId;
        ClaimReference = claimReference;
        ClaimedAmount = claimedAmount;
        Status = InsuranceClaimStatus.Pending;
    }

    public InsuranceClaim Submit()
    {
        EnsureStatus(InsuranceClaimStatus.Pending, nameof(Submit));
        Status = InsuranceClaimStatus.Submitted;
        SubmittedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public InsuranceClaim Approve(Money approvedAmount)
    {
        if (Status is not (InsuranceClaimStatus.Submitted or InsuranceClaimStatus.UnderReview))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                $"Cannot approve claim in status {Status}.");
        }

        ApprovedAmount = approvedAmount;
        Status = approvedAmount.Amount >= ClaimedAmount.Amount
            ? InsuranceClaimStatus.Approved
            : InsuranceClaimStatus.PartiallyApproved;

        return this;
    }

    public InsuranceClaim Reject(string reason)
    {
        Status = InsuranceClaimStatus.Rejected;
        RejectionReason = reason;
        return this;
    }

    public InsuranceClaim Settle()
    {
        if (Status is not (InsuranceClaimStatus.Approved or InsuranceClaimStatus.PartiallyApproved))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                $"Cannot settle claim in status {Status}.");
        }

        Status = InsuranceClaimStatus.Settled;
        SettledAt = DateTimeOffset.UtcNow;
        return this;
    }

    private void EnsureStatus(InsuranceClaimStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                $"Cannot perform '{operation}' on claim with status '{Status}'. Expected '{expected}'.");
        }
    }
}
