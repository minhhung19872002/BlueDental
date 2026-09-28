using System;
using BlueDental.Promotions;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One voucher redeemed on a treatment slip — the reference's
/// <c>appliedCoupons[]</c> on <c>patient-treatments</c>.
///
/// A snapshot, not a link: the code, name and terms are copied at the moment
/// the slip opens, so a voucher later edited or deleted still reads on the slip
/// exactly as it was applied. <see cref="DiscountAmount"/> is what the server
/// worked out for that voucher against the slip total on that day; the slip's
/// <see cref="TreatmentPlan.VoucherDiscountAmount"/> is the sum.
///
/// Measured on staging 2026-09-28 (BA item 24): a coupon stays on the slip and
/// its use is never given back, even when every line under it is cancelled.
/// </summary>
public class TreatmentPlanVoucher : Entity<Guid>
{
    public Guid TreatmentPlanId { get; private set; }
    public Guid VoucherId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public decimal? MaxDiscountAmount { get; private set; }

    /// <summary>What this voucher took off the slip, in đồng.</summary>
    public decimal DiscountAmount { get; private set; }

    protected TreatmentPlanVoucher() { }

    internal static TreatmentPlanVoucher FromVoucher(
        Guid id,
        Guid treatmentPlanId,
        Voucher voucher,
        decimal discountAmount)
    {
        Check.NotNull(voucher, nameof(voucher));

        if (discountAmount < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Voucher discount must not be negative.");
        }

        return new TreatmentPlanVoucher
        {
            Id = id,
            TreatmentPlanId = treatmentPlanId,
            VoucherId = voucher.Id,
            Code = voucher.Code,
            Name = voucher.Name,
            DiscountType = voucher.DiscountType,
            DiscountValue = voucher.DiscountValue,
            MaxDiscountAmount = voucher.MaxDiscountAmount,
            DiscountAmount = discountAmount
        };
    }
}
