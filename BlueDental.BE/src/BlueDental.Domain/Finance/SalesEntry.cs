using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Finance;

/// <summary>
/// A cash voucher — either a receipt (phiếu thu) or a payment (phiếu chi).
///
/// Reference: <c>GET /api/v1/sales?type=income|expense&amp;approved=true|false</c>,
/// rendered by the "Quản lý thu chi" report tab.
/// Expenses go through an approval step (permission <c>reportCost.approve</c>).
/// </summary>
public class SalesEntry : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public SalesEntryType Type { get; private set; }

    /// <summary>Mục thu / mục chi — see <see cref="CashflowCategory"/>.</summary>
    public Guid CategoryId { get; private set; }

    /// <summary>Set when the money is tied to a patient.</summary>
    public Guid? PatientId { get; private set; }

    /// <summary>Nhân viên thu / chi.</summary>
    public Guid StaffId { get; private set; }

    public decimal Amount { get; private set; }

    public PaymentChannel Channel { get; private set; }

    /// <summary>Nội dung thu / chi.</summary>
    public string Description { get; private set; } = string.Empty;

    /// <summary>Business date of the voucher (may differ from the creation time).</summary>
    public DateOnly EntryDate { get; private set; }

    public SalesApprovalStatus ApprovalStatus { get; private set; }
    public Guid? ApprovedByStaffId { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }
    public string? RejectionReason { get; private set; }

    protected SalesEntry() { }

    public static SalesEntry Record(
        Guid id,
        Guid clinicBranchId,
        string code,
        SalesEntryType type,
        Guid categoryId,
        Guid staffId,
        decimal amount,
        PaymentChannel channel,
        string description,
        DateOnly entryDate,
        Guid? patientId = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Check.NotNullOrWhiteSpace(description, nameof(description));

        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.InvalidAmount,
                "A cash voucher amount must be greater than zero.");
        }

        return new SalesEntry
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Code = code,
            Type = type,
            CategoryId = categoryId,
            StaffId = staffId,
            PatientId = patientId,
            Amount = amount,
            Channel = channel,
            Description = description,
            EntryDate = entryDate,
            // Only expenses need an approval step.
            ApprovalStatus = type == SalesEntryType.Expense
                ? SalesApprovalStatus.Pending
                : SalesApprovalStatus.NotRequired
        };
    }

    public SalesEntry UpdateDetails(
        Guid categoryId,
        decimal amount,
        PaymentChannel channel,
        string description,
        DateOnly entryDate,
        Guid? patientId)
    {
        GuardEditable();
        Check.NotNullOrWhiteSpace(description, nameof(description));

        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.InvalidAmount,
                "A cash voucher amount must be greater than zero.");
        }

        CategoryId = categoryId;
        Amount = amount;
        Channel = channel;
        Description = description;
        EntryDate = entryDate;
        PatientId = patientId;
        return this;
    }

    public SalesEntry Approve(Guid approvedByStaffId)
    {
        if (ApprovalStatus == SalesApprovalStatus.NotRequired)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.ApprovalNotApplicable,
                "Only expense vouchers require approval.");
        }

        if (ApprovalStatus == SalesApprovalStatus.Approved)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.AlreadyApproved,
                "This voucher has already been approved.");
        }

        ApprovalStatus = SalesApprovalStatus.Approved;
        ApprovedByStaffId = approvedByStaffId;
        ApprovedAt = DateTimeOffset.UtcNow;
        RejectionReason = null;
        return this;
    }

    public SalesEntry Reject(Guid rejectedByStaffId, string reason)
    {
        if (ApprovalStatus == SalesApprovalStatus.NotRequired)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.ApprovalNotApplicable,
                "Only expense vouchers require approval.");
        }

        if (ApprovalStatus == SalesApprovalStatus.Approved)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.AlreadyApproved,
                "An approved voucher cannot be rejected; reverse it instead.");
        }

        Check.NotNullOrWhiteSpace(reason, nameof(reason));

        ApprovalStatus = SalesApprovalStatus.Rejected;
        ApprovedByStaffId = rejectedByStaffId;
        ApprovedAt = DateTimeOffset.UtcNow;
        RejectionReason = reason;
        return this;
    }

    /// <summary>
    /// True when the voucher should be counted in the cashflow totals: receipts
    /// always count, expenses only once approved.
    /// </summary>
    public bool CountsTowardsCashflow =>
        ApprovalStatus is SalesApprovalStatus.NotRequired or SalesApprovalStatus.Approved;

    /// <summary>Signed contribution to the period result: receipts add, payments subtract.</summary>
    public decimal SignedAmount =>
        !CountsTowardsCashflow ? 0m : Type == SalesEntryType.Income ? Amount : -Amount;

    private void GuardEditable()
    {
        if (ApprovalStatus == SalesApprovalStatus.Approved)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.VoucherLocked,
                "An approved voucher can no longer be edited.");
        }
    }
}
