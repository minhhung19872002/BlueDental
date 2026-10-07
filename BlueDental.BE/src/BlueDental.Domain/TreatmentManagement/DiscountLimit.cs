using System;
using System.Globalization;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Cụm 11 mục 12 — "Quy định giảm giá": the most one account may take off a
/// line or a slip when it consults or adds services — a share of the price
/// (<see cref="MaxPercent"/>) and an amount in VNĐ (<see cref="MaxAmount"/>).
/// Either may be absent; both absent means no limit.
///
/// A discount is measured against the price the line would otherwise be sold
/// at (the catalogue's "Giá sau giảm"), so lowering the unit price counts just
/// as a % / VNĐ discount does. Only a discount that grows is checked: keeping
/// or lowering one someone else gave is always allowed, so a line a manager
/// discounted can still be edited by staff with a smaller limit.
/// See docs/clone/pages/discount-limit.md.
/// </summary>
public sealed record DiscountLimit(decimal? MaxPercent, decimal? MaxAmount)
{
    public bool IsUnlimited => MaxPercent is null && MaxAmount is null;

    /// <summary>A discount as it stood before a change: what it took off, and off how much.</summary>
    public readonly record struct Measure(decimal ListAmount, decimal Discount)
    {
        public static readonly Measure None = new(0m, 0m);

        /// <summary>The share taken off; a discount on something worth nothing is all of it.</summary>
        public decimal Percent => Discount <= 0m ? 0m : ListAmount > 0m ? Discount * 100m / ListAmount : 100m;
    }

    /// <param name="listAmount">What the line or slip comes to before this discount.</param>
    /// <param name="discount">The discount it would carry.</param>
    /// <param name="previous">The same line or slip before this change (<see cref="Measure.None"/> for a new one).</param>
    /// <remarks>
    /// The share and the amount are each compared with their own previous
    /// value: keeping a discount someone else gave is fine, but a change that
    /// makes either grow — a smaller quantity under the same VNĐ discount is a
    /// bigger share — must fit this account's limit.
    /// </remarks>
    public void EnsureAllows(decimal listAmount, decimal discount, Measure previous = default)
    {
        if (IsUnlimited || discount <= 0m) return;

        if (MaxAmount is { } maxAmount && discount > maxAmount && discount > previous.Discount)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.DiscountAboveUserAmount)
                .WithData("MaxAmount", maxAmount.ToString("#,0", Vietnamese));
        }

        var percent = new Measure(listAmount, discount).Percent;
        if (MaxPercent is { } maxPercent && percent > maxPercent + Tolerance && percent > previous.Percent + Tolerance)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.DiscountAbovePercent)
                .WithData("MaxPercent", maxPercent.ToString("0.##", Vietnamese));
        }
    }

    /// <summary>A rounded đồng must not tip a share just over the limit.</summary>
    private const decimal Tolerance = 0.005m;

    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    public static void EnsureValid(decimal? maxPercent, decimal? maxAmount)
    {
        if (maxPercent is < 0m or > 100m || maxAmount is < 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidDiscountLimit);
        }
    }
}
