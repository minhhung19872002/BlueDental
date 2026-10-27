using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
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
    /// this receipt pays under its catalog name in slip order, and Số tiền còn
    /// lại = the slip's payable total − what it has collected ("Đã thanh toán"
    /// only, other receipts) − this receipt.
    /// </summary>
    public async Task<PaymentReceiptSnapshot> TakeAsync(PatientPayment payment, Guid? creatorId)
    {
        var planId = payment.TreatmentPlanId!.Value;
        var planQuery = await plans.WithDetailsAsync(x => x.Services);
        var plan = planQuery.Single(x => x.Id == planId);

        var patient = await patients.GetAsync(payment.PatientId);

        var catalogIds = plan.Services.Select(s => s.ServiceId).Distinct().ToList();
        var catalogNames = (await catalog.GetListAsync(c => catalogIds.Contains(c.Id)))
            .ToDictionary(c => c.Id, c => c.Name);

        var lines = plan.Services
            .OrderBy(s => s.SortOrder)
            .ThenByDescending(s => s.CreationTime)
            .Select(s => (Line: s, Share: payment.AmountFor(s.Id)))
            .Where(x => x.Share > 0m)
            .Select(x => new PaymentReceiptSnapshotLine(
                catalogNames.GetValueOrDefault(x.Line.ServiceId) ?? x.Line.Code, x.Share))
            .ToList();

        var paymentQuery = await payments.GetQueryableAsync();
        var paidBefore = paymentQuery
            .Where(x => x.TreatmentPlanId == planId && x.Id != payment.Id)
            .Select(x => new { x.Kind, x.Amount })
            .ToList()
            .Sum(x => x.Kind == PatientPaymentKind.Refund ? -x.Amount : x.Amount);

        var names = await FullNamesAsync([creatorId]);
        return PaymentReceiptSnapshot.Take(
            patient.PatientCode,
            patient.FullName,
            plan.Code,
            ClinicCalendar.DateOf(payment.PaidAt),
            payment.Method,
            payment.Amount,
            plan.PayableAmount,
            paidBefore,
            NameOf(names, creatorId) ?? currentUser.UserName ?? string.Empty,
            lines);
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
        Remaining = content.Remaining,
        RemainingInWords = content.RemainingInWords,
        CreatorName = content.CreatorName,
        Lines = content.Lines
            .Select(line => new PaymentReceiptContentLineDto { Name = line.Name, Amount = line.Amount })
            .ToList()
    };
}
