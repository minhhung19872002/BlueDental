using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Finance;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
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
public class ClinicReportAppService : BlueDentalAppService, IClinicReportAppService
{
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<SalesEntry, Guid> _salesRepository;
    private readonly IRepository<CashflowCategory, Guid> _categoryRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<ClinicBranch, Guid> _branchRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public ClinicReportAppService(
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<SalesEntry, Guid> salesRepository,
        IRepository<CashflowCategory, Guid> categoryRepository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<ClinicBranch, Guid> branchRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _paymentRepository = paymentRepository;
        _planRepository = planRepository;
        _salesRepository = salesRepository;
        _categoryRepository = categoryRepository;
        _patientRepository = patientRepository;
        _catalogRepository = catalogRepository;
        _appointmentRepository = appointmentRepository;
        _branchRepository = branchRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _softDeleteFilter = softDeleteFilter;
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
            ByEWallet = SumBy(collected, PaymentMethodKind.EWallet),
            RefundByCash = SumBy(refunds, PaymentMethodKind.Cash),
            RefundByBanking = SumBy(refunds, PaymentMethodKind.Banking),
            RefundByCard = SumBy(refunds, PaymentMethodKind.Card),
            RefundByEWallet = SumBy(refunds, PaymentMethodKind.EWallet),
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
                            ? line.Status == TreatmentServiceStatus.Cancelled ? $"{name}{L["BE:Report:CancelledSuffix"]}" : name
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

        var otherIncomeEntries = sales
            .Where(s => s.Type == SalesEntryType.Income && s.CountsTowardsCashflow)
            .ToList();

        var expenseEntries = sales
            .Where(s => s.Type == SalesEntryType.Expense && s.CountsTowardsCashflow)
            .ToList();

        var otherIncome = otherIncomeEntries.Sum(s => s.Amount);
        var expense = expenseEntries.Sum(s => s.Amount);
        var totalRevenue = treatmentIncome + otherIncome;

        var categoryNames = await CategoryNamesAsync(
            otherIncomeEntries.Concat(expenseEntries).Select(s => s.CategoryId));

        return new BusinessResultDto
        {
            TotalRevenue = totalRevenue,
            TreatmentIncome = treatmentIncome,
            OtherIncome = otherIncome,
            TreatmentRefund = treatmentRefund,
            Expense = expense,
            Result = totalRevenue - treatmentRefund - expense,
            OtherIncomeByCategory = GroupByCategory(otherIncomeEntries, categoryNames),
            ExpenseByCategory = GroupByCategory(expenseEntries, categoryNames)
        };
    }

    /// <summary>
    /// The reference lists one indented row per mục thu / mục chi under "BE:Col:OtherIncome"
    /// and "BE:Col:Expenses" (empty when there are no vouchers). Ordered by amount, largest first.
    /// </summary>
    private static List<BusinessResultCategoryDto> GroupByCategory(
        IEnumerable<SalesEntry> entries,
        IReadOnlyDictionary<Guid, string> categoryNames)
    {
        return entries
            .GroupBy(s => s.CategoryId)
            .Select(g => new BusinessResultCategoryDto
            {
                CategoryId = g.Key,
                Name = categoryNames.TryGetValue(g.Key, out var name) ? name : "—",
                Amount = g.Sum(s => s.Amount)
            })
            .OrderByDescending(x => x.Amount)
            .ThenBy(x => x.Name)
            .ToList();
    }

    private async Task<IReadOnlyDictionary<Guid, string>> CategoryNamesAsync(IEnumerable<Guid> ids)
    {
        var wanted = ids.Distinct().ToList();
        if (wanted.Count == 0)
            return new Dictionary<Guid, string>();

        // A deleted category still names its sub-row on the reference's Kết quả kinh doanh.
        using var _ = _softDeleteFilter.Disable();
        var categories = await _categoryRepository.GetListAsync(c => wanted.Contains(c.Id));
        return categories.ToDictionary(c => c.Id, c => c.Name);
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Export)]
    public async Task<byte[]> ExportPatientHistoryAsync(ClinicReportQueryDto input)
    {
        var rows = await GetPatientHistoryAsync(input);

        return ExcelSheet.Build(
            "Doanh so",
            L["BE:Perm:SalesVisits"],
            new List<ExcelColumn<PatientHistoryRowDto>>
            {
                new(L["BE:Col:Date"], row => row.Date.Date, 14),
                new(L["BE:Col:CustomerCode"], row => row.PatientCode, 16),
                new(L["BE:Col:CustomerName"], row => row.PatientName, 26),
                new(L["BE:Col:ReceivingDoctor"], row => row.StaffName, 22),
                new(L["BE:Col:TreatmentService"], row => row.ServiceNames, 40),
                new(L["BE:Col:Quantity"], row => row.Quantity, 12),
                new(L["BE:Col:Total"], row => row.EffectiveAmount, 16),
                new(L["BE:Status:Paid"], row => row.TotalPaid, 16),
                new(L["BE:Col:NewCustomer"], row => row.IsNewPatient ? L["BE:Common:Yes"].Value : L["BE:Common:No"].Value, 12)
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
            (L["BE:Col:TotalRevenue"], result.TotalRevenue),
            (L["BE:Col:TreatmentIncome"], result.TreatmentIncome),
            (L["BE:Col:OtherIncome"], result.OtherIncome),
            (L["BE:Col:TreatmentRefund"], -result.TreatmentRefund),
            (L["BE:Col:Expenses"], -result.Expense),
            (L["BE:Perm:BusinessResult"], result.Result)
        };

        return ExcelSheet.Build(
            "Ket qua kinh doanh",
            L["BE:Perm:BusinessResult"],
            new List<ExcelColumn<(string Category, decimal Amount)>>
            {
                new(L["BE:Field:LineItem"], row => row.Category, 34),
                new(L["BE:Field:Amount"], row => row.Amount, 20)
            },
            rows,
            PeriodLabel(input));
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<ServiceLineDto>> GetServiceLinesAsync(ClinicReportQueryWithDoctorDto input)
    {
        var plans = await PlansAsync(input);
        if (plans.Count == 0) return [];

        var payments = await PaymentsAsync(input);

        var patientIds = plans.Select(p => p.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var serviceIds = plans.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery.Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var staffIds = plans.Select(p => p.DentistId).Distinct().ToList();
        var allStaffIds = staffIds.Concat(
            plans.SelectMany(p => p.Services).Where(s => s.ConsultantStaffId.HasValue).Select(s => s.ConsultantStaffId!.Value)
        ).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(allStaffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
        var branchNames = await BranchNamesAsync(plans.Select(p => p.BranchId));

        var lines = new List<ServiceLineDto>();

        foreach (var plan in plans.OrderByDescending(p => p.CreationTime))
        {
            var patient = patients.GetValueOrDefault(plan.PatientId);
            var doctorName = staffNames.GetValueOrDefault(plan.DentistId) ?? "—";

            foreach (var svc in plan.Services)
            {
                if (input.DoctorId.HasValue && plan.DentistId != input.DoctorId.Value) continue;

                var svcName = serviceNames.GetValueOrDefault(svc.ServiceId) ?? svc.Code;
                var cancelled = svc.Status == TreatmentServiceStatus.Cancelled;
                var counselor = svc.ConsultantStaffId.HasValue
                    ? staffNames.GetValueOrDefault(svc.ConsultantStaffId.Value) ?? ""
                    : "";

                var paidAmount = payments
                    .Where(p => p.TreatmentPlanId == plan.Id && p.Kind == PatientPaymentKind.Payment)
                    .SelectMany(p => p.Lines)
                    .Where(l => l.TreatmentServiceId == svc.Id)
                    .Sum(l => l.Amount);

                var statusStr = svc.Status switch
                {
                    TreatmentServiceStatus.Created => "created",
                    TreatmentServiceStatus.InProgress => "inProgress",
                    TreatmentServiceStatus.Done => "completed",
                    TreatmentServiceStatus.Cancelled => "cancelled",
                    _ => svc.Status.ToString().ToLowerInvariant()
                };

                lines.Add(new ServiceLineDto
                {
                    Id = svc.Id,
                    Date = plan.CreationTime.ToString("yyyy-MM-dd"),
                    PatientCode = patient?.PatientCode ?? "—",
                    PatientName = patient?.Name ?? "—",
                    PatientLabel = patient != null ? $"[{patient.PatientCode}] - {patient.Name}" : "—",
                    CounselorName = counselor,
                    DoctorName = doctorName,
                    ServiceName = svcName,
                    TicketCode = plan.Code,
                    Status = statusStr,
                    Cancelled = cancelled,
                    Quantity = svc.Quantity,
                    TotalAmount = cancelled ? -svc.EffectiveAmount : svc.EffectiveAmount,
                    PaidAmount = paidAmount,
                    BranchName = branchNames.GetValueOrDefault(plan.BranchId) ?? ""
                });
            }
        }

        return lines;
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<PaymentLineDto>> GetPaymentLinesAsync(ClinicReportQueryDto input)
    {
        var payments = (await PaymentsWithDetailsAsync(input))
            .Where(p => p.Kind == PatientPaymentKind.Payment)
            .OrderByDescending(p => p.PaidAt)
            .ToList();

        if (payments.Count == 0) return [];

        var patientIds = payments.Select(p => p.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var planIds = payments.Where(p => p.TreatmentPlanId.HasValue).Select(p => p.TreatmentPlanId!.Value).Distinct().ToList();
        var planQuery = await _planRepository.WithDetailsAsync(p => p.Services);
        var plans = planQuery.Where(p => planIds.Contains(p.Id)).ToDictionary(p => p.Id);

        var serviceIds = plans.Values.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery.Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var staffIds = payments.Select(p => p.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var branchNames = await BranchNamesAsync(payments.Select(p => p.ClinicBranchId));

        return payments.Select(p =>
        {
            var patient = patients.GetValueOrDefault(p.PatientId);
            var plan = p.TreatmentPlanId.HasValue ? plans.GetValueOrDefault(p.TreatmentPlanId.Value) : null;
            var svcNames = plan != null
                ? string.Join(", ", plan.Services.Select(s => serviceNames.GetValueOrDefault(s.ServiceId) ?? s.Code))
                : "";
            var cancelledNames = plan?.Services
                .Where(s => s.Status == TreatmentServiceStatus.Cancelled)
                .Select(s => serviceNames.GetValueOrDefault(s.ServiceId) ?? s.Code)
                .ToList() ?? new List<string>();
            var channelInt = (int)p.Method;

            return new PaymentLineDto
            {
                Id = p.Id,
                Date = p.PaidAt.ToString("yyyy-MM-dd"),
                PatientLabel = patient != null ? $"[{patient.PatientCode}] - {patient.Name}" : "—",
                PatientCode = patient?.PatientCode ?? "—",
                PatientName = patient?.Name ?? "—",
                PaymentCode = p.Code,
                CreatedBy = staffNames.GetValueOrDefault(p.StaffId) ?? "—",
                TreatmentCode = plan?.Code ?? "",
                BranchName = branchNames.GetValueOrDefault(p.ClinicBranchId) ?? "",
                ServiceNames = svcNames,
                CancelledServiceNames = cancelledNames,
                InvoiceAmount = plan?.TotalAmount ?? p.Amount,
                PaidAmount = p.Amount,
                ActualReceived = p.Amount,
                RemainingPrepaid = 0,
                Channel = channelInt,
                PaymentInfo = "",
                Note = p.Note ?? ""
            };
        }).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<RefundLineDto>> GetRefundLinesAsync(ClinicReportQueryDto input)
    {
        var refunds = (await PaymentsAsync(input))
            .Where(p => p.Kind == PatientPaymentKind.Refund)
            .OrderByDescending(p => p.PaidAt)
            .ToList();

        if (refunds.Count == 0) return [];

        var patientIds = refunds.Select(p => p.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var planIds = refunds.Where(p => p.TreatmentPlanId.HasValue).Select(p => p.TreatmentPlanId!.Value).Distinct().ToList();
        var planQuery = await _planRepository.WithDetailsAsync(p => p.Services);
        var plans = planQuery.Where(p => planIds.Contains(p.Id)).ToDictionary(p => p.Id);

        var serviceIds = plans.Values.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery.Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        return refunds.Select(r =>
        {
            var patient = patients.GetValueOrDefault(r.PatientId);
            var plan = r.TreatmentPlanId.HasValue ? plans.GetValueOrDefault(r.TreatmentPlanId.Value) : null;
            var svcNames = plan != null
                ? string.Join(", ", plan.Services.Select(s => serviceNames.GetValueOrDefault(s.ServiceId) ?? s.Code))
                : "";

            return new RefundLineDto
            {
                Id = r.Id,
                Date = r.PaidAt.ToString("yyyy-MM-dd"),
                PatientLabel = patient != null ? $"[{patient.PatientCode}] - {patient.Name}" : "—",
                PatientCode = patient?.PatientCode ?? "—",
                PatientName = patient?.Name ?? "—",
                RefundCode = r.Code,
                ServiceNames = svcNames,
                RefundAmount = r.Amount,
                Channel = (int)r.Method,
                Note = r.Note ?? ""
            };
        }).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<DebtLineDto>> GetDebtLinesAsync(ClinicReportQueryDto input)
    {
        var plans = await PlansAsync(input);
        if (plans.Count == 0) return [];

        var payments = await PaymentsAsync(input);

        var patientIds = plans.Select(p => p.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var serviceIds = plans.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery.Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var staffIds = plans.Select(p => p.DentistId)
            .Concat(plans.SelectMany(p => p.Services).Where(s => s.ConsultantStaffId.HasValue).Select(s => s.ConsultantStaffId!.Value))
            .Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var lines = new List<DebtLineDto>();

        foreach (var plan in plans.OrderByDescending(p => p.CreationTime))
        {
            var patient = patients.GetValueOrDefault(plan.PatientId);
            var paid = payments
                .Where(p => p.TreatmentPlanId == plan.Id && p.Kind == PatientPaymentKind.Payment)
                .Sum(p => p.Amount);
            var refunded = payments
                .Where(p => p.TreatmentPlanId == plan.Id && p.Kind == PatientPaymentKind.Refund)
                .Sum(p => p.Amount);
            var debtIncurred = plan.TotalAmount - paid;
            if (debtIncurred <= 0) continue;

            // The reference lists every service of the plan and chips the cancelled / replaced ones.
            foreach (var svc in plan.Services)
            {
                var svcName = serviceNames.GetValueOrDefault(svc.ServiceId) ?? svc.Code;
                var status = svc.Status switch
                {
                    TreatmentServiceStatus.Cancelled => "cancelled",
                    TreatmentServiceStatus.Replaced => "replaced",
                    _ => string.Empty
                };
                var counselor = svc.ConsultantStaffId.HasValue
                    ? staffNames.GetValueOrDefault(svc.ConsultantStaffId.Value) ?? ""
                    : "";
                var doctorName = staffNames.GetValueOrDefault(plan.DentistId) ?? "—";

                lines.Add(new DebtLineDto
                {
                    Id = svc.Id,
                    Date = plan.CreationTime.ToString("yyyy-MM-dd"),
                    PatientLabel = patient != null ? $"[{patient.PatientCode}] - {patient.Name}" : "—",
                    CounselorName = counselor,
                    DoctorName = doctorName,
                    ServiceName = svcName,
                    Status = status,
                    Quantity = svc.Quantity,
                    DebtIncurred = debtIncurred,
                    DebtUsed = 0,
                    DebtRefund = refunded
                });
            }
        }

        return lines;
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<List<PrepaidLineDto>> GetPrepaidLinesAsync(ClinicReportQueryDto input)
    {
        var payments = (await PaymentsAsync(input))
            .OrderBy(p => p.PaidAt)
            .ToList();

        var prepaidPayments = payments.Where(p => p.Kind == PatientPaymentKind.Prepaid).ToList();
        if (prepaidPayments.Count == 0) return [];

        var patientIds = prepaidPayments.Select(p => p.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => new { p.PatientCode, Name = $"{p.LastName} {p.FirstName}" });

        var balances = new Dictionary<Guid, decimal>();
        var lines = new List<PrepaidLineDto>();

        foreach (var p in prepaidPayments)
        {
            var patient = patients.GetValueOrDefault(p.PatientId);
            var before = balances.GetValueOrDefault(p.PatientId);
            var amount = p.Amount;
            var after = before + amount;
            balances[p.PatientId] = after;

            lines.Add(new PrepaidLineDto
            {
                Id = p.Id,
                Date = p.PaidAt.ToString("yyyy-MM-dd"),
                PatientLabel = patient != null ? $"[{patient.PatientCode}] - {patient.Name}" : "—",
                EventType = "deposit",
                // Staging (2026-09-22) shows the slip's service, its voucher
                // (THANHTOAN-31/DT32/2026) and the slip's treating dentists on a
                // "BE:Field:DepositIncurred" row. A local top-up is held outside any
                // slip, so only the voucher exists; the other two stay blank.
                ServiceName = "",
                PaymentCode = p.Code,
                DoctorName = "-",
                Amount = amount,
                BalanceAfter = after
            });
        }

        lines.Reverse();
        return lines;
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<SalesSummaryDto> GetSalesSummaryAsync(ClinicReportQueryDto input)
    {
        var payments = await PaymentsAsync(input);
        var plans = await PlansAsync(input);

        var collected = payments.Where(p => p.Kind == PatientPaymentKind.Payment).ToList();
        var refunds = payments.Where(p => p.Kind == PatientPaymentKind.Refund).ToList();
        var prepaid = payments.Where(p => p.Kind == PatientPaymentKind.Prepaid).ToList();

        var totalPaid = collected.Sum(p => p.Amount);
        var totalRefund = refunds.Sum(p => p.Amount);

        var debtIncurred = plans.Sum(p => p.TotalAmount) - totalPaid;
        var prepaidDeposits = prepaid.Sum(p => p.Amount);

        // "BE:Field:CurrentDepositBalance" is what the clinic holds now, not the period's
        // movement: staging (2026-09-22, year view) showed 10.070.000 in that
        // tile beside a 5.570.000 "BE:Field:Deposit" pill (phát sinh − tiêu dùng − hoàn).
        var allTimePayments = await PaymentsAsync(new ClinicReportQueryDto { ClinicBranchId = input.ClinicBranchId });
        var prepaidHeld = allTimePayments
            .Where(p => p.Kind == PatientPaymentKind.Prepaid)
            .Sum(p => p.Amount);

        return new SalesSummaryDto
        {
            Revenue = plans.Sum(p => p.TotalAmount),
            ByCash = SumBy(collected, PaymentMethodKind.Cash),
            ByBanking = SumBy(collected, PaymentMethodKind.Banking),
            ByCard = SumBy(collected, PaymentMethodKind.Card),
            ByDebt = debtIncurred > 0 ? debtIncurred : 0,
            Refund = totalRefund,
            RefundByCash = SumBy(refunds, PaymentMethodKind.Cash),
            RefundByBanking = SumBy(refunds, PaymentMethodKind.Banking),
            RefundByCard = SumBy(refunds, PaymentMethodKind.Card),
            ActualReceived = totalPaid - totalRefund,
            DebtIncurred = debtIncurred > 0 ? debtIncurred : 0,
            DebtUsed = 0,
            DebtRefund = 0,
            PrepaidIncurred = prepaidDeposits,
            PrepaidConsumed = 0,
            PrepaidRefund = 0,
            PrepaidBalance = prepaidHeld
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportSales.Read)]
    public async Task<OverviewStatsDto> GetOverviewStatsAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var weekStart = today.AddDays(-(int)now.DayOfWeek + 1);
        var weekEnd = weekStart.AddDays(6);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var yearStart = new DateOnly(today.Year, 1, 1);
        var yearEnd = new DateOnly(today.Year, 12, 31);

        var fullYearPayments = await PaymentsAsync(new ClinicReportQueryDto
        {
            ClinicBranchId = input.ClinicBranchId,
            FromDate = yearStart,
            ToDate = yearEnd
        });

        var fullYearPlans = await PlansAsync(new ClinicReportQueryDto
        {
            ClinicBranchId = input.ClinicBranchId,
            FromDate = yearStart,
            ToDate = yearEnd
        });

        var fullYearSales = await SalesAsync(new ClinicReportQueryDto
        {
            ClinicBranchId = input.ClinicBranchId,
            FromDate = yearStart,
            ToDate = yearEnd
        });

        var apptQuery = await _appointmentRepository.GetQueryableAsync();
        if (branchFilter.Count > 0)
            apptQuery = apptQuery.Where(a => branchFilter.Contains(a.BranchId));
        apptQuery = apptQuery.Where(a => a.Slot.Start >= ToInstant(yearStart) && a.Slot.Start < ToInstant(yearEnd).AddDays(1));
        var fullYearAppointments = apptQuery.ToList();

        var periods = new[]
        {
            ("Report:Period:Today", today, today),
            ("Report:Period:ThisWeek", weekStart, weekEnd),
            ("Report:Period:ThisMonth", monthStart, monthEnd),
            ("Report:Period:ThisYear", yearStart, yearEnd),
            ("Report:Period:All", DateOnly.MinValue, DateOnly.MaxValue)
        };

        var visitRows = new List<OverviewRowDto>();
        var appointmentRows = new List<OverviewRowDto>();
        var paymentRows = new List<OverviewRowDto>();
        var incomeExpenseRows = new List<OverviewRowDto>();

        foreach (var (label, from, to) in periods)
        {
            var isAll = from == DateOnly.MinValue;
            var pInRange = isAll ? fullYearPayments : fullYearPayments
                .Where(p => DateOnly.FromDateTime(p.PaidAt.UtcDateTime) >= from && DateOnly.FromDateTime(p.PaidAt.UtcDateTime) <= to).ToList();
            var plInRange = isAll ? fullYearPlans : fullYearPlans
                .Where(p => DateOnly.FromDateTime(p.CreationTime) >= from && DateOnly.FromDateTime(p.CreationTime) <= to).ToList();
            var aInRange = isAll ? fullYearAppointments : fullYearAppointments
                .Where(a => DateOnly.FromDateTime(a.Slot.Start.UtcDateTime) >= from && DateOnly.FromDateTime(a.Slot.Start.UtcDateTime) <= to).ToList();
            var sInRange = isAll ? fullYearSales : fullYearSales
                .Where(s => s.EntryDate >= from && s.EntryDate <= to).ToList();

            var newPatients = plInRange.GroupBy(p => p.PatientId)
                .Count(g => g.OrderBy(p => p.CreationTime).First().CreationTime >= ToInstant(from).UtcDateTime);
            var retPatients = pInRange.Select(p => p.PatientId).Distinct().Count() - newPatients;

            visitRows.Add(new OverviewRowDto { Label = label, Values = [Math.Max(newPatients, 0), Math.Max(retPatients, 0)] });

            var scheduled = aInRange.Count(a => a.Status != AppointmentStatus.Cancelled && a.Status != AppointmentStatus.NoShow);
            var arrived = aInRange.Count(a => a.Status is AppointmentStatus.CheckedIn or AppointmentStatus.InProgress or AppointmentStatus.Completed);
            var cancelled = aInRange.Count(a => a.Status == AppointmentStatus.Cancelled);
            appointmentRows.Add(new OverviewRowDto { Label = label, Values = [scheduled, arrived, cancelled] });

            var refundTotal = pInRange.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount);
            var paidTotal = pInRange.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount);
            paymentRows.Add(new OverviewRowDto { Label = label, Values = [refundTotal, paidTotal] });

            var income = sInRange.Where(s => s.Type == SalesEntryType.Income).Sum(s => s.Amount);
            var expense = sInRange.Where(s => s.Type == SalesEntryType.Expense && s.CountsTowardsCashflow).Sum(s => s.Amount);
            incomeExpenseRows.Add(new OverviewRowDto { Label = label, Values = [income, expense] });
        }

        var monthNames = Enumerable.Range(1, 12).Select(m => $"T{m}").ToList();
        var visitSeries = new List<MonthlyPointDto>();
        var appointmentSeries = new List<MonthlyPointDto>();
        var paymentSeries = new List<MonthlyPointDto>();
        var incomeExpenseSeries = new List<MonthlyPointDto>();

        for (var m = 1; m <= 12; m++)
        {
            var mStart = new DateOnly(today.Year, m, 1);
            var mEnd = mStart.AddMonths(1).AddDays(-1);

            var mPayments = fullYearPayments.Where(p => DateOnly.FromDateTime(p.PaidAt.UtcDateTime) >= mStart && DateOnly.FromDateTime(p.PaidAt.UtcDateTime) <= mEnd).ToList();
            var mPlans = fullYearPlans.Where(p => DateOnly.FromDateTime(p.CreationTime) >= mStart && DateOnly.FromDateTime(p.CreationTime) <= mEnd).ToList();
            var mAppts = fullYearAppointments.Where(a => DateOnly.FromDateTime(a.Slot.Start.UtcDateTime) >= mStart && DateOnly.FromDateTime(a.Slot.Start.UtcDateTime) <= mEnd).ToList();
            var mSales = fullYearSales.Where(s => s.EntryDate >= mStart && s.EntryDate <= mEnd).ToList();

            var newP = mPlans.GroupBy(p => p.PatientId).Count(g => g.OrderBy(p => p.CreationTime).First().CreationTime >= ToInstant(mStart).UtcDateTime);
            var retP = mPayments.Select(p => p.PatientId).Distinct().Count() - newP;
            visitSeries.Add(new MonthlyPointDto { Month = monthNames[m - 1], A = Math.Max(newP, 0), B = Math.Max(retP, 0) });

            var mScheduled = mAppts.Count(a => a.Status != AppointmentStatus.Cancelled && a.Status != AppointmentStatus.NoShow);
            var mArrived = mAppts.Count(a => a.Status is AppointmentStatus.CheckedIn or AppointmentStatus.InProgress or AppointmentStatus.Completed);
            var mCancelled = mAppts.Count(a => a.Status == AppointmentStatus.Cancelled);
            appointmentSeries.Add(new MonthlyPointDto { Month = monthNames[m - 1], A = mScheduled, B = mArrived, C = mCancelled });

            var mRefund = mPayments.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount);
            var mPaid = mPayments.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount);
            paymentSeries.Add(new MonthlyPointDto { Month = monthNames[m - 1], A = mRefund, B = mPaid });

            var mIncome = mSales.Where(s => s.Type == SalesEntryType.Income).Sum(s => s.Amount);
            var mExpense = mSales.Where(s => s.Type == SalesEntryType.Expense && s.CountsTowardsCashflow).Sum(s => s.Amount);
            incomeExpenseSeries.Add(new MonthlyPointDto { Month = monthNames[m - 1], A = mIncome, B = mExpense });
        }

        return new OverviewStatsDto
        {
            Visits = visitRows,
            Appointments = appointmentRows,
            Payments = paymentRows,
            IncomeExpense = incomeExpenseRows,
            VisitSeries = visitSeries,
            AppointmentSeries = appointmentSeries,
            PaymentSeries = paymentSeries,
            IncomeExpenseSeries = incomeExpenseSeries
        };
    }

    /// <summary>
    /// Branch names keyed by id for the rows being reported. Each row shows its
    /// own branch: a user who can see several branches gets a mixed list, and
    /// the column is still filled when the query carries no branch at all.
    /// </summary>
    private async Task<Dictionary<Guid, string>> BranchNamesAsync(IEnumerable<Guid> branchIds)
    {
        var ids = branchIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        var branches = await _branchRepository.GetListAsync(b => ids.Contains(b.Id));
        return branches.ToDictionary(b => b.Id, b => b.Name);
    }

    private async Task<List<PatientPayment>> PaymentsWithDetailsAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _paymentRepository.WithDetailsAsync(x => x.Lines);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.FromDate.HasValue)
            query = query.Where(x => x.PaidAt >= ToInstant(input.FromDate.Value));
        if (input.ToDate.HasValue)
            query = query.Where(x => x.PaidAt < ToInstant(input.ToDate.Value).AddDays(1));

        return query.ToList();
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
