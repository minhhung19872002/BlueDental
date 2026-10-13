using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Printing;
using Microsoft.Extensions.Options;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.EInvoicing;

/// <summary>
/// What the staff screen, the QR page and the PHIẾU THU share about a request:
/// which receipts may get one, how the receipt's services read, the QR link
/// of a receipt and the next Mã yêu cầu.
/// </summary>
public class InvoiceRequestSources(
    IRepository<PatientPayment, Guid> payments,
    IRepository<TreatmentPlan, Guid> plans,
    IRepository<CatalogEntry, Guid> catalog,
    IRepository<InvoiceRequest, Guid> requests,
    IRepository<InvoiceRequestLink, Guid> links,
    IDataFilter dataFilter,
    IAsyncQueryableExecuter executer,
    IOptions<PaymentReceiptOptions> receiptOptions) : ITransientDependency
{
    public const string CodePrefix = "YC-HD-";

    /// <summary>
    /// The receipt, "Chưa thanh toán" included (its PHIẾU THU prints, so its QR
    /// must work); a refund or a cancelled receipt gets no invoice.
    /// </summary>
    public async Task<PatientPayment> EligiblePaymentAsync(Guid patientPaymentId)
    {
        PatientPayment? payment;
        using (dataFilter.Disable<ISettleable>())
        {
            var query = await payments.WithDetailsAsync(x => x.Lines);
            payment = await executer.FirstOrDefaultAsync(query.Where(x => x.Id == patientPaymentId));
        }

        if (payment == null)
        {
            // "Hủy phiếu" soft-deletes the receipt: say so rather than "no entity".
            using (dataFilter.Disable<ISoftDelete>())
            using (dataFilter.Disable<ISettleable>())
            {
                if (await payments.AnyAsync(x => x.Id == patientPaymentId))
                {
                    throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.ReceiptCancelled);
                }
            }

            throw new EntityNotFoundException(typeof(PatientPayment), patientPaymentId);
        }

        if (payment.Kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.ReceiptNotEligible);
        }

        return payment;
    }

    /// <summary>The receipt's patient's payments that may get a request and have none live.</summary>
    public async Task<List<PatientPayment>> OpenPaymentsAsync(Guid patientId)
    {
        List<PatientPayment> list;
        using (dataFilter.Disable<ISettleable>())
        {
            var query = await payments.WithDetailsAsync(x => x.Lines);
            list = await executer.ToListAsync(query
                .Where(x => x.PatientId == patientId && x.Kind == PatientPaymentKind.Payment)
                .OrderByDescending(x => x.PaidAt));
        }

        var ids = list.Select(x => x.Id).ToList();
        var taken = (await requests.GetQueryableAsync())
            .Where(r => ids.Contains(r.PatientPaymentId) && r.Status != InvoiceRequestStatus.Cancelled)
            .Select(r => r.PatientPaymentId);
        var takenIds = (await executer.ToListAsync(taken)).ToHashSet();
        return list.Where(x => !takenIds.Contains(x.Id)).ToList();
    }

    /// <summary>Mã phiếu thu of each receipt, cancelled ones included so an old row still reads.</summary>
    public async Task<Dictionary<Guid, string>> PaymentCodesAsync(IReadOnlyCollection<Guid> patientPaymentIds)
    {
        using (dataFilter.Disable<ISettleable>())
        using (dataFilter.Disable<ISoftDelete>())
        {
            var query = (await payments.GetQueryableAsync())
                .Where(p => patientPaymentIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Code });
            return (await executer.ToListAsync(query)).ToDictionary(p => p.Id, p => p.Code);
        }
    }

    /// <summary>
    /// Dịch vụ on the form: the services the receipt paid, by their catalog
    /// name; a receipt without a slip falls back to its note.
    /// </summary>
    public async Task<string> ServiceNameAsync(PatientPayment payment)
    {
        var names = await ServiceNamesAsync([payment]);
        return names.GetValueOrDefault(payment.Id, string.Empty);
    }

    public async Task<Dictionary<Guid, string>> ServiceNamesAsync(IReadOnlyCollection<PatientPayment> receipts)
    {
        var planIds = receipts.Select(r => r.TreatmentPlanId).OfType<Guid>().Distinct().ToList();
        var planQuery = await plans.WithDetailsAsync(x => x.Services);
        var slips = await executer.ToListAsync(planQuery.Where(p => planIds.Contains(p.Id)));
        var services = slips.SelectMany(p => p.Services).ToDictionary(s => s.Id);
        var catalogIds = services.Values.Select(s => s.ServiceId).Distinct().ToList();
        var catalogNames = (await catalog.GetListAsync(c => catalogIds.Contains(c.Id)))
            .ToDictionary(c => c.Id, c => c.Name);

        return receipts.ToDictionary(r => r.Id, r =>
        {
            var named = r.Lines
                .Select(l => services.GetValueOrDefault(l.TreatmentServiceId))
                .OfType<TreatmentService>()
                .Select(s => catalogNames.GetValueOrDefault(s.ServiceId) ?? s.Code)
                .Distinct()
                .ToList();
            return named.Count > 0 ? string.Join(", ", named) : r.Note ?? string.Empty;
        });
    }

    /// <summary>The receipt's QR link, made on first print and given a new lifetime when it lapsed.</summary>
    public async Task<InvoiceRequestLink> EnsureLinkAsync(PatientPayment payment, Guid linkId)
    {
        var link = await links.FirstOrDefaultAsync(l => l.PatientPaymentId == payment.Id);
        if (link == null)
        {
            link = InvoiceRequestLink.Issue(
                linkId, payment.ClinicBranchId, payment.PatientId, payment.Id, payment.TreatmentPlanId, DateTimeOffset.UtcNow);
            return await links.InsertAsync(link, autoSave: true);
        }

        link.Renew(DateTimeOffset.UtcNow);
        return await links.UpdateAsync(link, autoSave: true);
    }

    /// <summary>The page the QR opens: <c>{web app}/invoice-request/{token}</c>.</summary>
    public string PublicUrlOf(InvoiceRequestLink link) =>
        $"{receiptOptions.Value.PublicFormBaseUrl.TrimEnd('/')}/invoice-request/{link.Token}";

    /// <summary>A receipt takes one live request (Đã hủy frees it).</summary>
    public async Task EnsureNoLiveRequestAsync(Guid patientPaymentId)
    {
        if (await requests.AnyAsync(r =>
                r.PatientPaymentId == patientPaymentId && r.Status != InvoiceRequestStatus.Cancelled))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.AlreadyRequested);
        }
    }

    /// <summary>"YC-HD-0001", numbered per branch; deleted rows keep their number.</summary>
    public async Task<string> NextCodeAsync(Guid clinicBranchId)
    {
        using (dataFilter.Disable<ISoftDelete>())
        {
            var query = await requests.GetQueryableAsync();
            var taken = (await executer.ToListAsync(query
                    .Where(r => r.ClinicBranchId == clinicBranchId && r.Code.StartsWith(CodePrefix))
                    .Select(r => r.Code)))
                .ToHashSet(StringComparer.Ordinal);

            var next = taken.Count + 1;
            while (taken.Contains(Format(next)))
            {
                next++;
            }

            return Format(next);
        }
    }

    private static string Format(int number) => $"{CodePrefix}{number:D4}";
}
