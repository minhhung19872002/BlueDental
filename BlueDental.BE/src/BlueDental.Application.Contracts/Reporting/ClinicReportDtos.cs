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

    /// <summary>Ví điện tử — the reference's "Ví momo".</summary>
    public decimal ByEWallet { get; set; }

    public decimal RefundByCash { get; set; }
    public decimal RefundByBanking { get; set; }
    public decimal RefundByCard { get; set; }
    public decimal RefundByEWallet { get; set; }

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

    /// <summary>"Thu khác" broken down by mục thu — the indented rows under it on the reference.</summary>
    public List<BusinessResultCategoryDto> OtherIncomeByCategory { get; set; } = new();

    /// <summary>"Chi phí" broken down by mục chi.</summary>
    public List<BusinessResultCategoryDto> ExpenseByCategory { get; set; } = new();
}

public class BusinessResultCategoryDto
{
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class ClinicReportQueryWithDoctorDto : ClinicReportQueryDto
{
    public Guid? DoctorId { get; set; }
}

/// <summary>Tab "Doanh số" > Khách hàng phát sinh dịch vụ — one service line inside a treatment ticket.</summary>
public class ServiceLineDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PatientLabel { get; set; } = string.Empty;
    public string CounselorName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string TicketCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool Cancelled { get; set; }
    public int Quantity { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    /// <summary>Last column of the reference's "Khách hàng phát sinh dịch vụ" export.</summary>
    public string BranchName { get; set; } = string.Empty;
}

/// <summary>Tab "Doanh số" > Thanh toán — one payment voucher.</summary>
public class PaymentLineDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string PatientLabel { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PaymentCode { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public string TreatmentCode { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public string ServiceNames { get; set; } = string.Empty;
    /// <summary>Names of the plan's services that are cancelled: the reference chips them "(đã huỷ)".</summary>
    public List<string> CancelledServiceNames { get; set; } = new();
    public decimal InvoiceAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal ActualReceived { get; set; }
    public decimal RemainingPrepaid { get; set; }
    public int Channel { get; set; }
    public string PaymentInfo { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

/// <summary>Tab "Doanh số" > Hoàn tiền — one refund voucher.</summary>
public class RefundLineDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string PatientLabel { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string RefundCode { get; set; } = string.Empty;
    public string ServiceNames { get; set; } = string.Empty;
    public decimal RefundAmount { get; set; }
    public int Channel { get; set; }
    public string Note { get; set; } = string.Empty;
}

/// <summary>Tab "Doanh số" > Dư nợ — one debt line.</summary>
public class DebtLineDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string PatientLabel { get; set; } = string.Empty;
    public string CounselorName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    /// <summary>"cancelled" / "replaced" when the service line carries that status (the reference's chip), else empty.</summary>
    public string Status { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal DebtIncurred { get; set; }
    public decimal DebtUsed { get; set; }
    public decimal DebtRefund { get; set; }
}

/// <summary>Tab "Doanh số" > Tạm ứng — one prepaid event.</summary>
public class PrepaidLineDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public string PatientLabel { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string PaymentCode { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
}

/// <summary>Stat summary for the expense tab.</summary>
public class SalesSummaryDto
{
    public decimal Revenue { get; set; }
    public decimal ByCash { get; set; }
    public decimal ByBanking { get; set; }
    public decimal ByCard { get; set; }
    public decimal ByDebt { get; set; }
    public decimal Refund { get; set; }
    public decimal RefundByCash { get; set; }
    public decimal RefundByBanking { get; set; }
    public decimal RefundByCard { get; set; }
    public decimal ActualReceived { get; set; }
    public decimal DebtIncurred { get; set; }
    public decimal DebtUsed { get; set; }
    public decimal DebtRefund { get; set; }
    public decimal PrepaidIncurred { get; set; }
    public decimal PrepaidConsumed { get; set; }
    public decimal PrepaidRefund { get; set; }
    public decimal PrepaidBalance { get; set; }
}

public class DailyTotalDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class OverviewRowDto
{
    public string Label { get; set; } = string.Empty;
    public List<decimal> Values { get; set; } = new();
}

public class MonthlyPointDto
{
    public string Month { get; set; } = string.Empty;
    public decimal A { get; set; }
    public decimal B { get; set; }
    public decimal? C { get; set; }
}

/// <summary>Pie chart + 4 overview cards data.</summary>
public class OverviewStatsDto
{
    public List<OverviewRowDto> Visits { get; set; } = new();
    public List<OverviewRowDto> Appointments { get; set; } = new();
    public List<OverviewRowDto> Payments { get; set; } = new();
    public List<OverviewRowDto> IncomeExpense { get; set; } = new();
    public List<MonthlyPointDto> VisitSeries { get; set; } = new();
    public List<MonthlyPointDto> AppointmentSeries { get; set; } = new();
    public List<MonthlyPointDto> PaymentSeries { get; set; } = new();
    public List<MonthlyPointDto> IncomeExpenseSeries { get; set; } = new();
}

/// <summary>
/// Báo cáo doanh số và kết quả kinh doanh.
/// </summary>
public interface IClinicReportAppService : IApplicationService
{
    Task<PaymentStatSummaryDto> GetPaymentStatAsync(ClinicReportQueryDto input);
    Task<List<PatientHistoryRowDto>> GetPatientHistoryAsync(ClinicReportQueryDto input);
    Task<BusinessResultDto> GetBusinessResultAsync(ClinicReportQueryDto input);

    Task<byte[]> ExportPatientHistoryAsync(ClinicReportQueryDto input);
    Task<byte[]> ExportBusinessResultAsync(ClinicReportQueryDto input);

    Task<List<ServiceLineDto>> GetServiceLinesAsync(ClinicReportQueryWithDoctorDto input);
    Task<List<PaymentLineDto>> GetPaymentLinesAsync(ClinicReportQueryDto input);
    Task<List<RefundLineDto>> GetRefundLinesAsync(ClinicReportQueryDto input);
    Task<List<DebtLineDto>> GetDebtLinesAsync(ClinicReportQueryDto input);
    Task<List<PrepaidLineDto>> GetPrepaidLinesAsync(ClinicReportQueryDto input);
    Task<SalesSummaryDto> GetSalesSummaryAsync(ClinicReportQueryDto input);
    Task<OverviewStatsDto> GetOverviewStatsAsync(ClinicReportQueryDto input);
}
