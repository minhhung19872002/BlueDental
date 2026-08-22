using System.Collections.Generic;
using Volo.Abp;
using BlueDental.Values;

namespace BlueDental.TreatmentManagement.Values;

/// <summary>
/// Denormalised money rollup attached to a patient, a treatment plan or a
/// treatment service line.
///
/// Mirrors the reference application's <c>payment</c> object, which is repeated
/// verbatim on <c>patientSummary</c>, <c>patient-treatments</c> and
/// <c>treatmentServices</c>. All amounts are VND (no minor unit).
/// </summary>
public class PaymentSummary : ComparableValueObject
{
    /// <summary>Tổng dự kiến thu — contracted value of all service lines.</summary>
    public decimal TotalPrice { get; private set; }

    /// <summary>Đã thu — money actually collected.</summary>
    public decimal TotalPaid { get; private set; }

    /// <summary>Dự kiến thu còn lại — <see cref="TotalPrice"/> not yet collected.</summary>
    public decimal TotalDue { get; private set; }

    /// <summary>Phải thu — collectable now (completed work that is unpaid).</summary>
    public decimal Receivable { get; private set; }

    /// <summary>Đã thu của phần chưa hoàn tất.</summary>
    public decimal PaidUncompleted { get; private set; }

    /// <summary>Giá trị đã hoàn tất — value of completed service lines.</summary>
    public decimal CompletedValue { get; private set; }

    /// <summary>Đã hoàn — refunded to the patient.</summary>
    public decimal TotalRefund { get; private set; }

    /// <summary>Dư nợ — debt arising from completed but unpaid work.</summary>
    public decimal Debt { get; private set; }

    /// <summary>Chiết khấu đã áp dụng.</summary>
    public decimal Discount { get; private set; }

    /// <summary>Dư nợ tồn — carried-over debt balance.</summary>
    public decimal OutstandingDebt { get; private set; }

    /// <summary>Phần dư nợ tồn đã được sử dụng để cấn trừ.</summary>
    public decimal OutstandingDebtConsumed { get; private set; }

    /// <summary>Trả trước / tiền giữ hộ khách.</summary>
    public decimal Prepaid { get; private set; }

    /// <summary>Số tiền chuyển tiếp từ hồ sơ trước (null when not applicable).</summary>
    public decimal? CarryOverAmount { get; private set; }

    protected PaymentSummary() { }

    public PaymentSummary(
        decimal totalPrice = 0m,
        decimal totalPaid = 0m,
        decimal totalDue = 0m,
        decimal receivable = 0m,
        decimal paidUncompleted = 0m,
        decimal completedValue = 0m,
        decimal totalRefund = 0m,
        decimal debt = 0m,
        decimal discount = 0m,
        decimal outstandingDebt = 0m,
        decimal outstandingDebtConsumed = 0m,
        decimal prepaid = 0m,
        decimal? carryOverAmount = null)
    {
        if (totalPrice < 0m || totalPaid < 0m || totalRefund < 0m || discount < 0m || prepaid < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.NegativePaymentAmount,
                "Payment rollup amounts must not be negative.");
        }

        TotalPrice = totalPrice;
        TotalPaid = totalPaid;
        TotalDue = totalDue;
        Receivable = receivable;
        PaidUncompleted = paidUncompleted;
        CompletedValue = completedValue;
        TotalRefund = totalRefund;
        Debt = debt;
        Discount = discount;
        OutstandingDebt = outstandingDebt;
        OutstandingDebtConsumed = outstandingDebtConsumed;
        Prepaid = prepaid;
        CarryOverAmount = carryOverAmount;
    }

    public static PaymentSummary Zero() => new();

    /// <summary>
    /// Recomputes the derived amounts from the primary ones so callers only have
    /// to supply what they actually know.
    /// </summary>
    public static PaymentSummary From(
        decimal totalPrice,
        decimal totalPaid,
        decimal completedValue,
        decimal totalRefund = 0m,
        decimal discount = 0m,
        decimal outstandingDebt = 0m,
        decimal outstandingDebtConsumed = 0m,
        decimal prepaid = 0m,
        decimal? carryOverAmount = null)
    {
        var netPaid = totalPaid - totalRefund;
        var totalDue = totalPrice - netPaid;
        var receivable = completedValue - netPaid;
        var debt = receivable > 0m ? receivable : 0m;
        var paidUncompleted = netPaid - completedValue;

        return new PaymentSummary(
            totalPrice: totalPrice,
            totalPaid: totalPaid,
            totalDue: totalDue,
            receivable: receivable,
            paidUncompleted: paidUncompleted > 0m ? paidUncompleted : 0m,
            completedValue: completedValue,
            totalRefund: totalRefund,
            debt: debt,
            discount: discount,
            outstandingDebt: outstandingDebt,
            outstandingDebtConsumed: outstandingDebtConsumed,
            prepaid: prepaid,
            carryOverAmount: carryOverAmount);
    }

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return TotalPrice;
        yield return TotalPaid;
        yield return TotalDue;
        yield return Receivable;
        yield return PaidUncompleted;
        yield return CompletedValue;
        yield return TotalRefund;
        yield return Debt;
        yield return Discount;
        yield return OutstandingDebt;
        yield return OutstandingDebtConsumed;
        yield return Prepaid;
        yield return CarryOverAmount;
    }
}
