using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class PaymentSummaryTests
{
    [Fact]
    public void Zero_Should_Have_All_Amounts_At_Zero()
    {
        var summary = PaymentSummary.Zero();

        Assert.Equal(0m, summary.TotalPrice);
        Assert.Equal(0m, summary.TotalPaid);
        Assert.Equal(0m, summary.Debt);
        Assert.Null(summary.CarryOverAmount);
    }

    [Fact]
    public void Should_Reject_Negative_Primary_Amounts()
    {
        Assert.Throws<BusinessException>(() => new PaymentSummary(totalPrice: -1m));
        Assert.Throws<BusinessException>(() => new PaymentSummary(totalPaid: -1m));
        Assert.Throws<BusinessException>(() => new PaymentSummary(totalRefund: -1m));
    }

    [Fact]
    public void From_Should_Derive_Due_And_Receivable()
    {
        // 10tr contracted, 4tr collected, 6tr of work completed
        var summary = PaymentSummary.From(
            totalPrice: 10_000_000m,
            totalPaid: 4_000_000m,
            completedValue: 6_000_000m);

        Assert.Equal(6_000_000m, summary.TotalDue);       // 10tr - 4tr
        Assert.Equal(2_000_000m, summary.Receivable);     // 6tr completed - 4tr paid
        Assert.Equal(2_000_000m, summary.Debt);
        Assert.Equal(0m, summary.PaidUncompleted);
    }

    [Fact]
    public void From_Should_Report_Prepaid_Work_As_PaidUncompleted()
    {
        // Patient paid more than the work completed so far
        var summary = PaymentSummary.From(
            totalPrice: 10_000_000m,
            totalPaid: 8_000_000m,
            completedValue: 3_000_000m);

        Assert.Equal(2_000_000m, summary.TotalDue);
        Assert.Equal(-5_000_000m, summary.Receivable);
        Assert.Equal(0m, summary.Debt);                   // never negative
        Assert.Equal(5_000_000m, summary.PaidUncompleted);
    }

    [Fact]
    public void From_Should_Net_Refunds_Against_Payments()
    {
        var summary = PaymentSummary.From(
            totalPrice: 10_000_000m,
            totalPaid: 5_000_000m,
            completedValue: 5_000_000m,
            totalRefund: 2_000_000m);

        Assert.Equal(7_000_000m, summary.TotalDue);       // 10tr - (5tr - 2tr)
        Assert.Equal(2_000_000m, summary.Debt);           // 5tr completed - 3tr net paid
    }

    [Fact]
    public void Should_Compare_By_Value()
    {
        var a = PaymentSummary.From(1000m, 500m, 500m);
        var b = PaymentSummary.From(1000m, 500m, 500m);

        Assert.Equal(a, b);
    }
}
