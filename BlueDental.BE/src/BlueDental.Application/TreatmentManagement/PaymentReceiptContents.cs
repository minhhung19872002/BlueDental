using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// What a PHIẾU THU says — shared by the receipt page and the branch's iPad
/// (P2610), which shows the same sheet to the customer without a staff login.
/// </summary>
public class PaymentReceiptContents(
    IRepository<PatientPayment, Guid> payments,
    IRepository<TreatmentPlan, Guid> plans,
    IRepository<Patient, Guid> patients,
    IRepository<CatalogEntry, Guid> catalog,
    IIdentityUserRepository users,
    IDataFilter dataFilter,
    ICurrentUser currentUser) : ITransientDependency
{
    /// <summary>
    /// The frozen content, or — for a receipt written before it was frozen —
    /// today's, counting paid receipts only.
    /// </summary>
    public async Task<PaymentReceiptSnapshot> ContentOfAsync(PatientPayment payment)
    {
        if (payment.ReceiptSnapshot != null)
        {
            return payment.ReceiptSnapshot;
        }

        using (dataFilter.Enable<ISettleable>())
        using (dataFilter.Enable<ISoftDelete>())
        {
            return await TakeAsync(payment, payment.CreatorId);
        }
    }

    /// <summary>
    /// What the PHIẾU THU says right now: the patient, the slip, each service
    /// this receipt settles in slip order — under the cashier's "Tên trên
    /// phiếu", else its catalog name, with its TN giảm, voucher share and the
    /// VAT inside its money — and Số tiền còn lại = the slip's payable total
    /// once the relief of the other paid receipts and of this one is off, its
    /// VAT re-figured (P2910), − what the others collected − this receipt.
    /// </summary>
    public async Task<PaymentReceiptSnapshot> TakeAsync(PatientPayment payment, Guid? creatorId)
    {
        var planId = payment.TreatmentPlanId!.Value;
        var planQuery = await plans.WithDetailsAsync(x => x.Services);
        var plan = planQuery.Single(x => x.Id == planId);

        var patient = await patients.GetAsync(payment.PatientId);
        var serviceNames = await ServiceNamesAsync(plan);

        var lines = plan.Services
            .OrderBy(s => s.SortOrder)
            .ThenByDescending(s => s.CreationTime)
            .Select(s => (Line: s, Parts: payment.Lines.Where(l => l.TreatmentServiceId == s.Id).ToList()))
            .Where(x => x.Parts.Sum(l => l.Settled) > 0m)
            .Select(x => new PaymentReceiptSnapshotLine(
                x.Parts.Select(l => l.ReceiptName).FirstOrDefault(n => n != null) ?? serviceNames[x.Line.Id],
                x.Parts.Sum(l => l.Amount),
                x.Parts.Sum(l => l.CashierDiscount),
                x.Parts.Sum(l => l.VoucherShare),
                x.Parts.Sum(l => l.TaxAmount ?? TreatmentPlan.TaxWithin(x.Line, l.Amount))))
            .ToList();

        var paymentQuery = await payments.GetQueryableAsync();
        var others = paymentQuery
            .Where(x => x.TreatmentPlanId == planId && x.Id != payment.Id)
            .ToList();
        var paidBefore = others.Sum(x => x.SignedAmount);
        var reliefBefore = others.Sum(x => x.Relief);
        var slipTotal = plan.PayableAmount - plan.ReliefOffPayable(LineSettlement.Of(plan, others.Append(payment)));

        var names = await FullNamesAsync([creatorId]);
        return PaymentReceiptSnapshot.Take(
            patient.PatientCode,
            patient.FullName,
            plan.Code,
            ClinicCalendar.DateOf(payment.PaidAt),
            payment.Method,
            payment.Amount,
            slipTotal,
            paidBefore,
            NameOf(names, creatorId) ?? currentUser.UserName ?? string.Empty,
            lines,
            reliefBefore,
            payment.VoucherCode);
    }

    /// <summary>
    /// Giảm giá thu ngân on each line of the receipt with the cashier's reason
    /// — for the accountant on the receipt page (P2910 step 6). The customer's
    /// sheet and the iPad never carry the reason.
    /// </summary>
    public async Task<List<PaymentReceiptDiscountDto>> CashierDiscountsOfAsync(PatientPayment payment)
    {
        var discounted = payment.Lines.Where(l => l.CashierDiscount > 0m).ToList();
        if (discounted.Count == 0 || payment.TreatmentPlanId is not { } planId)
        {
            return [];
        }

        var planQuery = await plans.WithDetailsAsync(x => x.Services);
        var serviceNames = await ServiceNamesAsync(planQuery.Single(x => x.Id == planId));
        return discounted
            .Select(l => new PaymentReceiptDiscountDto
            {
                Name = l.ReceiptName ?? serviceNames.GetValueOrDefault(l.TreatmentServiceId) ?? string.Empty,
                Amount = l.CashierDiscount,
                Reason = l.CashierDiscountReason
            })
            .ToList();
    }

    /// <summary>Each line of the slip under its catalog name, else its code.</summary>
    private async Task<Dictionary<Guid, string>> ServiceNamesAsync(TreatmentPlan plan)
    {
        var catalogIds = plan.Services.Select(s => s.ServiceId).Distinct().ToList();
        var catalogNames = (await catalog.GetListAsync(c => catalogIds.Contains(c.Id)))
            .ToDictionary(c => c.Id, c => c.Name);
        return plan.Services.ToDictionary(s => s.Id, s => catalogNames.GetValueOrDefault(s.ServiceId) ?? s.Code);
    }

    /// <summary>Staff as the printed sheets name them: họ + tên, else the login.</summary>
    public async Task<Dictionary<Guid, string>> FullNamesAsync(IEnumerable<Guid?> userIds)
    {
        var ids = userIds.OfType<Guid>().Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var list = await users.GetListByIdsAsync(ids);
        return list.ToDictionary(
            u => u.Id,
            u =>
            {
                var fullName = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
                return string.IsNullOrWhiteSpace(fullName) ? u.UserName : fullName;
            });
    }

    public static string? NameOf(Dictionary<Guid, string> names, Guid? userId) =>
        userId is { } id && names.TryGetValue(id, out var name) ? name : null;

    public static PaymentReceiptContentDto ToDto(PaymentReceiptSnapshot content) => new()
    {
        PatientCode = content.PatientCode,
        PayerName = content.PayerName,
        PlanCode = content.PlanCode,
        PaidOn = content.PaidOn,
        Method = content.Method,
        Amount = content.Amount,
        AmountInWords = content.AmountInWords,
        SlipTotal = content.SlipTotal,
        PaidBefore = content.PaidBefore,
        ReliefBefore = content.ReliefBefore ?? 0m,
        Relief = content.Relief ?? 0m,
        VoucherCode = content.VoucherCode,
        Remaining = content.Remaining,
        RemainingInWords = content.RemainingInWords,
        CreatorName = content.CreatorName,
        Lines = content.Lines
            .Select(line => new PaymentReceiptContentLineDto
            {
                Name = line.Name,
                Amount = line.Amount,
                CashierDiscount = line.CashierDiscount ?? 0m,
                VoucherShare = line.VoucherShare ?? 0m,
                TaxAmount = line.TaxAmount ?? 0m
            })
            .ToList()
    };
}
