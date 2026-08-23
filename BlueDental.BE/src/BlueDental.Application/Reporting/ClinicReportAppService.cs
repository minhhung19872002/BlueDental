using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Finance;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Reporting;

/// <summary>
/// Báo cáo doanh số (13.1) và kết quả kinh doanh (13.3).
///
/// Everything is derived at read time from the slips, the money movements and the
/// thu chi vouchers — there is no reporting table to drift out of date.
/// </summary>
[Authorize]
public class ClinicReportAppService : ApplicationService, IClinicReportAppService
{
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<SalesEntry, Guid> _salesRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public ClinicReportAppService(
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<SalesEntry, Guid> salesRepository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _paymentRepository = paymentRepository;
        _planRepository = planRepository;
        _salesRepository = salesRepository;
        _patientRepository = patientRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<PaymentStatSummaryDto> GetPaymentStatAsync(ClinicReportQueryDto input)
    {
        var payments = await PaymentsAsync(input);
        var sales = await SalesAsync(input);
        var plans = await PlansAsync(input);

        var collected = payments.Where(p => p.Kind == PatientPaymentKind.Payment).ToList();
        var refunds = payments.Where(p => p.Kind == PatientPaymentKind.Refund).ToList();

        var otherIncome = sales
            .Where(s => s.Type == SalesEntryType.Income && s.CountsTowardsCashflow)
            .Sum(s => s.Amount);

        var expense = sales
            .Where(s => s.Type == SalesEntryType.Expense && s.CountsTowardsCashflow)
            .Sum(s => s.Amount);

        var totalPaid = collected.Sum(p => p.Amount);
        var totalRefund = refunds.Sum(p => p.Amount);

        return new PaymentStatSummaryDto
        {
            TotalPrice = plans.Sum(p => p.TotalAmount),
            TotalPaid = totalPaid,
            TotalRefund = totalRefund,
            ByCash = SumBy(collected, PaymentMethodKind.Cash),
            ByBanking = SumBy(collected, PaymentMethodKind.Banking),
            ByCard = SumBy(collected, PaymentMethodKind.Card),
            ByOutstandingDebt = SumBy(collected, PaymentMethodKind.OutstandingDebt),
            RefundByCash = SumBy(refunds, PaymentMethodKind.Cash),
            RefundByBanking = SumBy(refunds, PaymentMethodKind.Banking),
            RefundByCard = SumBy(refunds, PaymentMethodKind.Card),
            TotalIncome = otherIncome,
            TotalExpense = expense,
            TotalOutstandingDebt = plans.Sum(p => p.CompletedValue) - totalPaid + totalRefund,
            TotalPrepaid = payments.Where(p => p.Kind == PatientPaymentKind.Prepaid).Sum(p => p.Amount),
            TotalActualReceived = totalPaid - totalRefund + otherIncome,
            PatientVisits = payments.Select(p => p.PatientId).Distinct().Count()
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<PatientHistoryRowDto>> GetPatientHistoryAsync(ClinicReportQueryDto input)
    {
        var plans = await PlansAsync(input);
        if (plans.Count == 0)
        {
            return [];
        }

        var payments = await PaymentsAsync(input);
        var patientIds = plans.Select(p => p.PatientId).Distinct().ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery
            .Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var serviceIds = plans.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery
            .Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var staffIds = plans.Select(p => p.DentistId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return plans
            .OrderByDescending(plan => plan.CreationTime)
            .Select(plan => new PatientHistoryRowDto
            {
                PatientId = plan.PatientId,
                PatientName = patients.TryGetValue(plan.PatientId, out var patient) ? patient.Name : "—",
                PatientCode = patients.TryGetValue(plan.PatientId, out var code) ? code.PatientCode : "—",
                Date = plan.CreationTime,
                StaffName = staffNames.TryGetValue(plan.DentistId, out var staff) ? staff : null,
                ServiceNames = string.Join(
                    ", ",
                    plan.Services.Select(line =>
                        serviceNames.TryGetValue(line.ServiceId, out var name)
                            ? line.Status == TreatmentServiceStatus.Cancelled ? $"{name}(đã hủy)" : name
                            : line.Code)),
                Quantity = plan.Services.Sum(line => line.Quantity),
                EffectiveAmount = plan.TotalAmount,
                TotalPaid = payments
                    .Where(p => p.TreatmentPlanId == plan.Id && p.Kind == PatientPaymentKind.Payment)
                    .Sum(p => p.Amount),
                // The reference marks a row as a new patient's first visit; the first
                // slip a patient ever opens is what that means here.
                IsNewPatient = plans
                    .Where(other => other.PatientId == plan.PatientId)
                    .OrderBy(other => other.CreationTime)
                    .First().Id == plan.Id
            })
            .ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.ReportResult.Read)]
    public async Task<BusinessResultDto> GetBusinessResultAsync(ClinicReportQueryDto input)
    {
        var payments = await PaymentsAsync(input);
        var sales = await SalesAsync(input);

        var treatmentIncome = payments
            .Where(p => p.Kind == PatientPaymentKind.Payment)
            .Sum(p => p.Amount);

        var treatmentRefund = payments
            .Where(p => p.Kind == PatientPaymentKind.Refund)
            .Sum(p => p.Amount);

        var otherIncome = sales
            .Where(s => s.Type == SalesEntryType.Income && s.CountsTowardsCashflow)
            .Sum(s => s.Amount);

        var expense = sales
            .Where(s => s.Type == SalesEntryType.Expense && s.CountsTowardsCashflow)
            .Sum(s => s.Amount);

        var totalRevenue = treatmentIncome + otherIncome;

        return new BusinessResultDto
        {
            TotalRevenue = totalRevenue,
            TreatmentIncome = treatmentIncome,
            OtherIncome = otherIncome,
            TreatmentRefund = treatmentRefund,
            Expense = expense,
            Result = totalRevenue - treatmentRefund - expense
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Export)]
    public async Task<byte[]> ExportPatientHistoryAsync(ClinicReportQueryDto input)
    {
        var rows = await GetPatientHistoryAsync(input);

        return ExcelSheet.Build(
            "Doanh so",
            "Doanh số và lượt khách",
            new List<ExcelColumn<PatientHistoryRowDto>>
            {
                new("Ngày", row => row.Date.Date, 14),
                new("Mã khách hàng", row => row.PatientCode, 16),
                new("Tên khách hàng", row => row.PatientName, 26),
                new("Bác sĩ tiếp nhận", row => row.StaffName, 22),
                new("Dịch vụ điều trị", row => row.ServiceNames, 40),
                new("Số lượng", row => row.Quantity, 12),
                new("Thành tiền", row => row.EffectiveAmount, 16),
                new("Đã thanh toán", row => row.TotalPaid, 16),
                new("Khách mới", row => row.IsNewPatient ? "Có" : "Không", 12)
            },
            rows,
            PeriodLabel(input));
    }

    [Authorize(BlueDentalAbilityPermissions.ReportResult.Export)]
    public async Task<byte[]> ExportBusinessResultAsync(ClinicReportQueryDto input)
    {
        var result = await GetBusinessResultAsync(input);

        var rows = new List<(string Category, decimal Amount)>
        {
            ("Doanh thu tổng", result.TotalRevenue),
            ("Thu từ dịch vụ điều trị", result.TreatmentIncome),
            ("Thu khác", result.OtherIncome),
            ("Hoàn tiền từ dịch vụ điều trị", -result.TreatmentRefund),
            ("Chi phí", -result.Expense),
            ("Kết quả kinh doanh", result.Result)
        };

        return ExcelSheet.Build(
            "Ket qua kinh doanh",
            "Kết quả kinh doanh",
            new List<ExcelColumn<(string Category, decimal Amount)>>
            {
                new("Khoản mục", row => row.Category, 34),
                new("Số tiền", row => row.Amount, 20)
            },
            rows,
            PeriodLabel(input));
    }

    private static string PeriodLabel(ClinicReportQueryDto input)
    {
        if (!input.FromDate.HasValue && !input.ToDate.HasValue)
        {
            return "Toàn bộ thời gian";
        }

        return $"Từ {input.FromDate:dd/MM/yyyy} đến {input.ToDate:dd/MM/yyyy}";
    }

    private static decimal SumBy(IEnumerable<PatientPayment> payments, PaymentMethodKind method) =>
        payments.Where(p => p.Method == method).Sum(p => p.Amount);

    private async Task<List<PatientPayment>> PaymentsAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _paymentRepository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.FromDate.HasValue)
            query = query.Where(x => x.PaidAt >= ToInstant(input.FromDate.Value));
        if (input.ToDate.HasValue)
            query = query.Where(x => x.PaidAt < ToInstant(input.ToDate.Value).AddDays(1));

        return query.ToList();
    }

    private async Task<List<SalesEntry>> SalesAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _salesRepository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.FromDate.HasValue)
            query = query.Where(x => x.EntryDate >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.EntryDate <= input.ToDate.Value);

        return query.ToList();
    }

    private async Task<List<TreatmentPlan>> PlansAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _planRepository.WithDetailsAsync(x => x.Services);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.BranchId));
        if (input.FromDate.HasValue)
            query = query.Where(x => x.CreationTime >= ToInstant(input.FromDate.Value).UtcDateTime);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.CreationTime < ToInstant(input.ToDate.Value).AddDays(1).UtcDateTime);

        return query.ToList();
    }

    private static DateTimeOffset ToInstant(DateOnly date) =>
        new(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
}
