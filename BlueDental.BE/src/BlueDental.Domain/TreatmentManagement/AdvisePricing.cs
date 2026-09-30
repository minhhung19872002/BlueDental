using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The money rules of one consulting line — price × quantity, less a discount
/// given as an amount or a percentage. A <see cref="PatientAdvise"/> and a
/// báo giá's own copy of it (<see cref="PatientQuoteLine"/>) are priced by the
/// same rules, so a quote never works a line out differently from the sheet.
/// </summary>
public static class AdvisePricing
{
    public static decimal Gross(decimal price, int quantity) => price * quantity;

    /// <summary>The discount as an amount, voucher share included, never above the line total.</summary>
    public static decimal Discount(
        decimal gross,
        DiscountType discountType,
        decimal discountValue,
        decimal? voucherDiscountAmount = null)
    {
        var discount = discountType switch
        {
            DiscountType.Money => discountValue,
            DiscountType.Percentage => Vnd.Round(gross * discountValue / 100m),
            _ => 0m
        };

        discount += voucherDiscountAmount ?? 0m;
        return discount > gross ? gross : discount;
    }

    public static void EnsurePricingValid(decimal price, int quantity)
    {
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
    }

    public static void EnsureDiscountValid(decimal gross, DiscountType discountType, decimal discountValue)
    {
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

        if (discountType == DiscountType.Money && discountValue > gross)
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
    }
}
