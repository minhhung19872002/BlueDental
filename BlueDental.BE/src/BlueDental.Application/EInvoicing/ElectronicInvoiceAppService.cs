using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.ClinicIntegration;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;

namespace BlueDental.EInvoicing;

/// <summary>
/// Xuất hóa đơn điện tử from a receipt.
///
/// One receipt → one invoice at EasyInvoice, keyed <c>bd-{receipt id}</c> so
/// a retry rewrites the same draft instead of filing a second one. Every
/// provider call is recorded in the integration call log (CLAUDE.md §9),
/// shape only — never the body, which names the patient, nor the header,
/// which carries the account password.
/// </summary>
[Authorize]
public class ElectronicInvoiceAppService : BlueDentalAppService, IElectronicInvoiceAppService
{
    private const string ImportOperation = "einvoice-import";
    private const string LookupOperation = "einvoice-lookup";
    private const string PdfOperation = "einvoice-pdf";

    private readonly IRepository<ElectronicInvoice, Guid> _invoices;
    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<CatalogEntry, Guid> _catalog;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IEasyInvoiceClient _provider;
    private readonly IOptions<EasyInvoiceOptions> _options;
    private readonly IUnitOfWorkManager _unitOfWorkManager;

    public ElectronicInvoiceAppService(
        IRepository<ElectronicInvoice, Guid> invoices,
        IRepository<PatientPayment, Guid> payments,
        IRepository<TreatmentPlan, Guid> plans,
        IRepository<Patient, Guid> patients,
        IRepository<CatalogEntry, Guid> catalog,
        IRepository<IntegrationCallLog, Guid> callLogs,
        BranchAccessChecker branchAccess,
        IEasyInvoiceClient provider,
        IOptions<EasyInvoiceOptions> options,
        IUnitOfWorkManager unitOfWorkManager)
    {
        _invoices = invoices;
        _payments = payments;
        _plans = plans;
        _patients = patients;
        _catalog = catalog;
        _callLogs = callLogs;
        _branchAccess = branchAccess;
        _provider = provider;
        _options = options;
        _unitOfWorkManager = unitOfWorkManager;
    }

    /// <summary>The provider-side key of a receipt's invoice — stable, so a retry overwrites.</summary>
    public static string IkeyOf(Guid patientPaymentId) => $"bd-{patientPaymentId:N}";

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId)
    {
        var options = _options.Value;
        if (!options.IsConfigured)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.NotConfigured);
        }

        var paymentQuery = await _payments.WithDetailsAsync(x => x.Lines);
        var payment = paymentQuery.FirstOrDefault(x => x.Id == patientPaymentId)
            ?? throw new EntityNotFoundException(typeof(PatientPayment), patientPaymentId);

        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        if (payment.Kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ReceiptNotInvoiceable);
        }

        var existing = await _invoices.FirstOrDefaultAsync(x => x.PatientPaymentId == payment.Id);
        existing?.EnsureReissuable();

        var draft = await BuildDraftAsync(payment, options.VatRate);
        var xml = EasyInvoiceXmlBuilder.Build(draft);

        var outcome = await _provider.ImportInvoiceAsync(xml);
        await LogAsync(payment.ClinicBranchId, ImportOperation, outcome, draft.Lines.Count);

        var now = Clock.Now;
        if (!outcome.Succeeded)
        {
            if (existing != null)
            {
                existing.RecordFailure(outcome.LogError, now);
                await _invoices.UpdateAsync(existing);
            }

            throw Refusal(outcome.LogError);
        }

        var invoice = existing ?? ElectronicInvoice.Create(
            GuidGenerator.Create(), payment.ClinicBranchId, payment.PatientId, payment.Id,
            payment.TreatmentPlanId, draft.Ikey, options.Pattern, draft);
        invoice.TakeAmounts(draft);

        var summary = outcome.Data?.FirstOrDefault(s =>
            string.Equals(s.Ikey, draft.Ikey, StringComparison.OrdinalIgnoreCase));
        if (summary != null)
        {
            invoice.ApplyProviderSummary(summary, now);
        }

        if (existing == null)
        {
            await _invoices.InsertAsync(invoice);
        }
        else
        {
            await _invoices.UpdateAsync(invoice);
        }

        return Map(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<ListResultDto<ElectronicInvoiceDto>> GetListAsync(GetElectronicInvoiceListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _invoices.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.PatientPaymentId.HasValue)
        {
            query = query.Where(x => x.PatientPaymentId == input.PatientPaymentId.Value);
        }

        if (input.TreatmentPlanId.HasValue)
        {
            query = query.Where(x => x.TreatmentPlanId == input.TreatmentPlanId.Value);
        }

        if (input.PatientId.HasValue)
        {
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        }

        var items = await AsyncExecuter.ToListAsync(query.OrderByDescending(x => x.CreationTime));
        return new ListResultDto<ElectronicInvoiceDto>(items.Select(Map).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<ElectronicInvoiceDto> SyncAsync(Guid id)
    {
        var invoice = await _invoices.GetAsync(id);
        await _branchAccess.CheckAsync(invoice.ClinicBranchId);

        var outcome = await _provider.GetByIkeysAsync([invoice.Ikey]);
        await LogAsync(invoice.ClinicBranchId, LookupOperation, outcome, 1);

        var now = Clock.Now;
        if (!outcome.Succeeded)
        {
            invoice.RecordFailure(outcome.LogError, now);
            await _invoices.UpdateAsync(invoice);
            throw Refusal(outcome.LogError);
        }

        var summary = outcome.Data?.FirstOrDefault(s =>
            string.Equals(s.Ikey, invoice.Ikey, StringComparison.OrdinalIgnoreCase));
        if (summary != null)
        {
            invoice.ApplyProviderSummary(summary, now);
        }
        else
        {
            invoice.RecordFailure("The provider no longer lists this invoice.", now);
        }

        await _invoices.UpdateAsync(invoice);
        return Map(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<byte[]> GetPdfAsync(Guid id)
    {
        var invoice = await _invoices.GetAsync(id);
        await _branchAccess.CheckAsync(invoice.ClinicBranchId);

        var outcome = await _provider.GetPdfAsync(invoice.Ikey);
        await LogAsync(invoice.ClinicBranchId, PdfOperation, outcome, 1);

        if (!outcome.Succeeded || outcome.Data == null)
        {
            throw Refusal(outcome.LogError);
        }

        return outcome.Data;
    }

    /// <summary>
    /// The invoice lines. A receipt split over services bills each service for
    /// its share; one with no split bills the slip as a single line. Names
    /// come from the Danh mục dịch vụ entry the line was sold from.
    /// </summary>
    private async Task<ElectronicInvoiceDraft> BuildDraftAsync(PatientPayment payment, int vatRate)
    {
        var patient = await _patients.GetAsync(payment.PatientId);
        TreatmentPlan? plan = null;
        if (payment.TreatmentPlanId.HasValue)
        {
            var planQuery = await _plans.WithDetailsAsync(x => x.Services);
            plan = planQuery.FirstOrDefault(x => x.Id == payment.TreatmentPlanId.Value);
        }

        var lines = await ServiceLinesAsync(payment, plan, vatRate);
        if (lines.Count == 0)
        {
            var code = plan?.Code ?? payment.Code;
            lines =
            [
                ElectronicInvoiceDraft.Line(
                    code, L["Treatment:EInvoice:LineName", code], L["Treatment:EInvoice:DefaultUnit"],
                    1m, payment.Amount, vatRate)
            ];
        }

        return new ElectronicInvoiceDraft
        {
            Ikey = IkeyOf(payment.Id),
            CustomerCode = patient.PatientCode,
            CustomerName = patient.FullName,
            CustomerAddress = patient.Contact?.Address ?? patient.OldAddress,
            CustomerPhone = patient.Contact?.PhoneNumber,
            PaymentMethod = payment.Method == PaymentMethodKind.Cash
                ? ElectronicInvoiceDraft.CashPaymentMethod
                : ElectronicInvoiceDraft.TransferPaymentMethod,
            VatRate = vatRate,
            Lines = lines
        }.Validated();
    }

    private async Task<List<ElectronicInvoiceLine>> ServiceLinesAsync(
        PatientPayment payment, TreatmentPlan? plan, int vatRate)
    {
        if (plan == null || payment.Lines.Count == 0)
        {
            return [];
        }

        var services = plan.Services.ToDictionary(s => s.Id);
        var serviceIds = payment.Lines
            .Where(l => services.ContainsKey(l.TreatmentServiceId))
            .Select(l => services[l.TreatmentServiceId].ServiceId)
            .Distinct()
            .ToList();
        var names = (await _catalog.GetListAsync(c => serviceIds.Contains(c.Id)))
            .ToDictionary(c => c.Id);

        var unit = L["Treatment:EInvoice:DefaultUnit"].Value;
        var lines = new List<ElectronicInvoiceLine>();
        foreach (var line in payment.Lines)
        {
            if (!services.TryGetValue(line.TreatmentServiceId, out var service))
            {
                continue;
            }

            names.TryGetValue(service.ServiceId, out var entry);
            lines.Add(ElectronicInvoiceDraft.Line(
                entry?.Code ?? service.Code,
                entry?.Name ?? service.Code,
                entry?.Unit ?? unit,
                1m,
                line.Amount,
                vatRate));
        }

        return lines;
    }

    /// <summary>
    /// The call log survives the refusal that follows it: written in its own
    /// unit of work, so throwing afterwards rolls back the receipt's row and
    /// nothing else.
    /// </summary>
    private async Task LogAsync<T>(Guid clinicBranchId, string operation, EasyInvoiceCallResult<T> outcome, int itemCount)
    {
        using var uow = _unitOfWorkManager.Begin(requiresNew: true);
        await _callLogs.InsertAsync(new IntegrationCallLog(
            GuidGenerator.Create(), clinicBranchId, operation, outcome.RequestPath,
            outcome.StatusCode, outcome.Succeeded, outcome.DurationMs, itemCount, outcome.LogError));
        await uow.CompleteAsync();
    }

    private static BusinessException Refusal(string? error) =>
        new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ProviderRefused)
            .WithData("Message", error ?? "no response");

    private static ElectronicInvoiceDto Map(ElectronicInvoice invoice) => new()
    {
        Id = invoice.Id,
        ClinicBranchId = invoice.ClinicBranchId,
        PatientId = invoice.PatientId,
        PatientPaymentId = invoice.PatientPaymentId,
        TreatmentPlanId = invoice.TreatmentPlanId,
        Provider = invoice.Provider,
        Ikey = invoice.Ikey,
        Pattern = invoice.Pattern,
        Serial = invoice.Serial,
        Status = invoice.Status,
        No = invoice.No,
        LookupCode = invoice.LookupCode,
        LinkView = invoice.LinkView,
        Total = invoice.Total,
        TaxAmount = invoice.TaxAmount,
        Amount = invoice.Amount,
        CustomerName = invoice.CustomerName,
        LastSyncedAt = invoice.LastSyncedAt,
        LastError = invoice.LastError,
        CreationTime = invoice.CreationTime
    };
}
