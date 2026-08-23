using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Reporting;

public class ClinicReportQueryDto
{
    public Guid? ClinicBranchId { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}

/// <summary>
/// The finance rollup behind "Doanh số và lượt khách". Mirrors the reference's
/// <c>payment-stat/summary</c>, limited to the figures BlueDental can actually
/// derive — the reference's carry-over and debt-topup fields have no source here
/// and are reported as zero rather than invented.
/// </summary>
public class PaymentStatSummaryDto
{
    public decimal TotalPrice { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalRefund { get; set; }

    public decimal ByCash { get; set; }
    public decimal ByBanking { get; set; }
    public decimal ByCard { get; set; }
    public decimal ByOutstandingDebt { get; set; }

    public decimal RefundByCash { get; set; }
    public decimal RefundByBanking { get; set; }
    public decimal RefundByCard { get; set; }

    /// <summary>Thu khác — receipts recorded on the thu chi screen.</summary>
    public decimal TotalIncome { get; set; }

    /// <summary>Chi phí — approved expenses.</summary>
    public decimal TotalExpense { get; set; }

    public decimal TotalOutstandingDebt { get; set; }
    public decimal TotalPrepaid { get; set; }

    /// <summary>What actually landed in the till: treatment money plus other income.</summary>
    public decimal TotalActualReceived { get; set; }

    /// <summary>Lượt khách — patients seen in the period.</summary>
    public int PatientVisits { get; set; }
}

/// <summary>One row of the revenue ledger — the reference's <c>patients/history</c>.</summary>
public class PatientHistoryRowDto
{
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty;
    public DateTimeOffset Date { get; set; }
    public string? StaffName { get; set; }
    public string ServiceNames { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal EffectiveAmount { get; set; }
    public decimal TotalPaid { get; set; }
    public bool IsNewPatient { get; set; }
}

/// <summary>
/// "Kết quả kinh doanh" — the six rows the reference shows on
/// <c>result-stat/summary</c>.
/// </summary>
public class BusinessResultDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TreatmentIncome { get; set; }
    public decimal OtherIncome { get; set; }
    public decimal TreatmentRefund { get; set; }
    public decimal Expense { get; set; }

    /// <summary>Revenue less refunds and expenses.</summary>
    public decimal Result { get; set; }
}

/// <summary>
/// Báo cáo doanh số và kết quả kinh doanh.
/// </summary>
public interface IClinicReportAppService : IApplicationService
{
    Task<PaymentStatSummaryDto> GetPaymentStatAsync(ClinicReportQueryDto input);
    Task<List<PatientHistoryRowDto>> GetPatientHistoryAsync(ClinicReportQueryDto input);
    Task<BusinessResultDto> GetBusinessResultAsync(ClinicReportQueryDto input);
}
