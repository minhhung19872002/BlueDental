using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.EInvoicing;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Billing;

/// <summary>
/// Tài chính → Thanh toán reads the receipts a treatment plan's Thanh toán tab
/// writes (BA note 2026-10-06: "Sau khi tạo phiếu thanh toán — đổ dữ liệu lên
/// trang Tài chính → Thanh toán"). Before this the screen read <see cref="Invoice"/>,
/// which nothing in the clinic's flow creates, so it stayed empty.
///
/// Only <see cref="PatientPaymentKind.Payment"/> — refunds and money held for a
/// patient stay on the patient's own tabs (owner's choice). A receipt cancelled
/// on its plan is deleted, so it leaves this list too.
/// </summary>
[Authorize]
public class PaymentLedgerAppService : BlueDentalAppService, IPaymentLedgerAppService
{
    private const int ExportLimit = 5000;

    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<CatalogEntry, Guid> _catalog;
    private readonly IRepository<ElectronicInvoice, Guid> _invoices;
    private readonly IIdentityUserRepository _users;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PaymentLedgerAppService(
        IRepository<PatientPayment, Guid> payments,
        IRepository<Patient, Guid> patients,
        IRepository<TreatmentPlan, Guid> plans,
        IRepository<CatalogEntry, Guid> catalog,
        IRepository<ElectronicInvoice, Guid> invoices,
        IIdentityUserRepository users,
        ICurrentClinicBranchResolver branchResolver)
    {
        _payments = payments;
        _patients = patients;
        _plans = plans;
        _catalog = catalog;
        _invoices = invoices;
        _users = users;
        _branchResolver = branchResolver;
    }

    private static readonly Dictionary<PaymentMethodKind, string> MethodLabels = new()
    {
        [PaymentMethodKind.Cash] = "Treatment:Payment:Cash",
        [PaymentMethodKind.Banking] = "Treatment:Payment:Banking",
        [PaymentMethodKind.EWallet] = "Treatment:Payment:EWallet",
        [PaymentMethodKind.Card] = "Treatment:Payment:Card",
        [PaymentMethodKind.OutstandingDebt] = "Treatment:Debt:OutstandingDebt"
    };

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PaymentLedgerResultDto> GetListAsync(GetPaymentLedgerInput input)
    {
        var query = await FilteredAsync(input);

        var totalCount = await AsyncExecuter.CountAsync(query);
        var totalAmount = totalCount == 0 ? 0m : await AsyncExecuter.SumAsync(query, x => x.Amount);

        // Newest first, and Id breaks the tie so paging stays stable.
        var page = await AsyncExecuter.ToListAsync(
            query
                .OrderByDescending(x => x.PaidAt)
                .ThenBy(x => x.Id)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PaymentLedgerResultDto(totalCount, await MapAsync(page), totalAmount);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Export)]
    public async Task<byte[]> ExportAsync(GetPaymentLedgerInput input)
    {
        var page = await GetListAsync(new GetPaymentLedgerInput
        {
            Filter = input.Filter,
            FromDate = input.FromDate,
            ToDate = input.ToDate,
            MaxResultCount = ExportLimit
        });

        return ExcelSheet.Build(
            "Thanh toan",
            L["BE:Common:Payment"],
            new List<ExcelColumn<PaymentLedgerItemDto>>
            {
                new(L["Treatment:Payment:PaymentCode"], row => row.Code, 28),
                new(L["BE:Col:Date"], row => ClinicCalendar.DateOf(row.PaidAt).ToDateTime(TimeOnly.MinValue), 14),
                new(L["BE:Perm:Customers"], row => row.PatientName, 26),
                new(L["Billing:Ledger:PatientCode"], row => row.PatientCode, 14),
                new(L["BE:Common:TreatmentPlan"], row => PlanLabel(row), 26),
                new(L["BE:Common:Service"], row => row.ServiceNames, 36),
                new(L["Billing:Amount"], row => row.Amount, 16),
                new(L["Billing:PaymentMethodLabel"], row => L[MethodLabels[row.Method]].Value, 16),
                new(L["Billing:Ledger:Cashier"], row => row.StaffName ?? string.Empty, 20),
                new(L["BE:Field:Note"], row => row.Note ?? string.Empty, 30)
            },
            page.Items);
    }

    private static string PlanLabel(PaymentLedgerItemDto row) =>
        string.IsNullOrEmpty(row.TreatmentPlanTitle)
            ? row.TreatmentPlanCode ?? string.Empty
            : $"{row.TreatmentPlanCode} - {row.TreatmentPlanTitle}";

    private async Task<IQueryable<PatientPayment>> FilteredAsync(GetPaymentLedgerInput input)
    {
        // The branch comes from the signed-in user, never from the request.
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = (await _payments.WithDetailsAsync(x => x.Lines))
            .Where(x => x.ClinicBranchId == branchId && x.Kind == PatientPaymentKind.Payment);

        // A day is the clinic's (UTC+7) day, not the server's.
        if (input.FromDate.HasValue)
        {
            var from = ClinicCalendar.StartOfDay(input.FromDate.Value);
            query = query.Where(x => x.PaidAt >= from);
        }

        if (input.ToDate.HasValue)
        {
            var to = ClinicCalendar.StartOfDay(input.ToDate.Value.AddDays(1));
            query = query.Where(x => x.PaidAt < to);
        }

        var patients = await _patients.GetQueryableAsync();
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Code.ToLower().Contains(term)
                || patients.Any(p => p.Id == x.PatientId
                    && ((p.LastName + " " + p.FirstName).ToLower().Contains(term)
                        || p.PatientCode.ToLower().Contains(term))));
        }

        return query;
    }

    /// <summary>
    /// A receipt with a published (or cancelled) invoice of its own is done; a
    /// Draft one is retried. A live whole-slip invoice bars every receipt of it.
    /// </summary>
    private static bool CanIssueEInvoice(PatientPayment payment, IReadOnlyCollection<ElectronicInvoice> invoices)
    {
        var own = invoices.FirstOrDefault(inv => inv.PatientPaymentId == payment.Id);
        if (own != null && own.Status != ElectronicInvoiceStatus.Draft)
        {
            return false;
        }

        return !invoices.Any(inv => inv.PatientPaymentId == null
            && inv.TreatmentPlanId == payment.TreatmentPlanId
            && inv.Status != ElectronicInvoiceStatus.Cancelled);
    }

    /// <summary>Names for one page, each kind resolved in a single read.</summary>
    private async Task<List<PaymentLedgerItemDto>> MapAsync(IReadOnlyCollection<PatientPayment> page)
    {
        if (page.Count == 0)
        {
            return [];
        }

        var patientIds = page.Select(x => x.PatientId).Distinct().ToList();
        var patients = (await _patients.GetListAsync(p => patientIds.Contains(p.Id)))
            .ToDictionary(p => p.Id);

        var planIds = page.Where(x => x.TreatmentPlanId.HasValue)
            .Select(x => x.TreatmentPlanId!.Value).Distinct().ToList();
        var plans = (await AsyncExecuter.ToListAsync(
                (await _plans.WithDetailsAsync(x => x.Services)).Where(x => planIds.Contains(x.Id))))
            .ToDictionary(x => x.Id);

        var services = plans.Values.SelectMany(p => p.Services).ToDictionary(s => s.Id);
        var catalogIds = services.Values.Select(s => s.ServiceId).Distinct().ToList();
        var catalogNames = (await _catalog.GetListAsync(c => catalogIds.Contains(c.Id)))
            .ToDictionary(c => c.Id, c => c.Name);

        var paymentIds = page.Select(x => x.Id).ToList();
        var invoices = await _invoices.GetListAsync(inv =>
            (inv.PatientPaymentId != null && paymentIds.Contains(inv.PatientPaymentId.Value))
            || (inv.PatientPaymentId == null && inv.TreatmentPlanId != null
                && planIds.Contains(inv.TreatmentPlanId.Value)));

        var staffIds = page.Select(x => x.StaffId).Distinct().ToList();
        var staffNames = (await _users.GetListByIdsAsync(staffIds))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return page.Select(payment =>
        {
            patients.TryGetValue(payment.PatientId, out var patient);
            TreatmentPlan? plan = null;
            if (payment.TreatmentPlanId is { } planId) plans.TryGetValue(planId, out plan);

            return new PaymentLedgerItemDto
            {
                Id = payment.Id,
                Code = payment.Code,
                PaidAt = payment.PaidAt,
                PatientId = payment.PatientId,
                PatientName = patient?.FullName ?? string.Empty,
                PatientCode = patient?.PatientCode ?? string.Empty,
                TreatmentPlanId = payment.TreatmentPlanId,
                TreatmentPlanCode = plan?.Code,
                TreatmentPlanTitle = plan?.Title,
                ServiceNames = string.Join(", ", payment.Lines
                    .Select(line => services.TryGetValue(line.TreatmentServiceId, out var service)
                        && catalogNames.TryGetValue(service.ServiceId, out var name) ? name : null)
                    .OfType<string>()
                    .Distinct()),
                Amount = payment.Amount,
                Method = payment.Method,
                StaffName = staffNames.GetValueOrDefault(payment.StaffId),
                Note = payment.Note,
                CanIssueEInvoice = CanIssueEInvoice(payment, invoices)
            };
        }).ToList();
    }
}
