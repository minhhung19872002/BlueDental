using System;
using System.Collections.Concurrent;
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
/// Hóa đơn điện tử, from a receipt (Thanh toán row) or a whole slip (the
/// Hóa đơn dialog of the plan).
///
/// One source → one invoice at EasyInvoice, keyed <c>bd-{receipt id}</c> or
/// <c>bd-plan-{slip id}</c> so a retry rewrites the same draft instead of
/// filing a second one. A slip is invoiced either whole or receipt by
/// receipt, never both. The invoice goes out under the branch's own account
/// (Công cụ › Hóa đơn › Cấu hình), else the server-wide one. Every provider
/// call is recorded in the integration call log (CLAUDE.md §9), shape only —
/// never the body, which names the patient, nor the header, which carries
/// the account password.
/// </summary>
[Authorize]
public class ElectronicInvoiceAppService : BlueDentalAppService, IElectronicInvoiceAppService
{
    private const string ImportOperation = "einvoice-import";
    private const string PublishOperation = "einvoice-publish";
    private const string LookupOperation = "einvoice-lookup";
    private const string PdfOperation = "einvoice-pdf";

    /// <summary>
    /// Keys with an issue in flight on this host: a double click must not race
    /// two provider calls. The unique Ikey index backs this across hosts.
    /// </summary>
    private static readonly ConcurrentDictionary<string, byte> InFlight = new(StringComparer.Ordinal);

    private readonly IRepository<ElectronicInvoice, Guid> _invoices;
    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<CatalogEntry, Guid> _catalog;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IEasyInvoiceClient _provider;
    private readonly EasyInvoiceSettingsResolver _accounts;
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
        EasyInvoiceSettingsResolver accounts,
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
        _accounts = accounts;
        _options = options;
        _unitOfWorkManager = unitOfWorkManager;
    }

    /// <summary>The provider-side key of a receipt's invoice — stable, so a retry overwrites.</summary>
    public static string IkeyOf(Guid patientPaymentId) => $"bd-{patientPaymentId:N}";

    /// <summary>The provider-side key of a whole slip's invoice.</summary>
    public static string PlanIkeyOf(Guid treatmentPlanId) => $"bd-plan-{treatmentPlanId:N}";

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<ElectronicInvoiceDraftDto> GetDraftAsync(GetElectronicInvoiceDraftInput input)
    {
        var source = await LoadSourceAsync(input.PatientPaymentId, input.TreatmentPlanId);
        var account = await _accounts.FindForBranchAsync(source.ClinicBranchId);
        var vatRate = account?.Settings.VatRate ?? _options.Value.VatRate;
        var patient = await _patients.GetAsync(source.PatientId);
        var existing = await _invoices.FirstOrDefaultAsync(x => x.Ikey == source.Ikey);

        return new ElectronicInvoiceDraftDto
        {
            PatientPaymentId = source.Payment?.Id,
            TreatmentPlanId = source.Plan?.Id,
            IsConfigured = account != null,
            ConfigName = account?.ConfigName,
            Pattern = Blank(account?.Settings.Pattern),
            Serial = account?.Settings.Serial,
            Numberings = await NumberingsAsync(source.ClinicBranchId, account?.Settings),
            DefaultVatRate = vatRate,
            CustomerCode = patient.PatientCode,
            BuyerName = patient.FullName,
            Address = patient.Contact?.Address ?? patient.OldAddress,
            Phone = patient.Contact?.PhoneNumber,
            Email = patient.Contact?.Email,
            NationalId = patient.NationalId,
            PaymentMethod = source.PaymentMethod,
            MaxAmount = source.MaxAmount,
            Lines = (await DefaultLinesAsync(source, vatRate)).Select(MapLine).ToList(),
            Existing = existing == null ? null : Map(existing)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<ElectronicInvoiceDto> IssueAsync(IssueElectronicInvoiceDto input)
    {
        var source = await LoadSourceAsync(input.PatientPaymentId, input.TreatmentPlanId);
        if (source.Payment is { Kind: not PatientPaymentKind.Payment })
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ReceiptNotInvoiceable);
        }

        EnsureVnd(input);
        var account = await _accounts.GetForBranchAsync(source.ClinicBranchId);
        var pattern = Blank(input.Pattern);
        var settings = pattern == null
            ? account
            : account with { Pattern = pattern, Serial = Blank(input.Serial) };
        if (string.IsNullOrWhiteSpace(settings.Pattern))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.PatternRequired);
        }

        if (!InFlight.TryAdd(source.Ikey, 0))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.IssueInProgress);
        }

        try
        {
            return await IssueLockedAsync(source, settings, input);
        }
        finally
        {
            InFlight.TryRemove(source.Ikey, out _);
        }
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public Task<ElectronicInvoiceDto> IssueFromPaymentAsync(Guid patientPaymentId) =>
        IssueAsync(new IssueElectronicInvoiceDto
        {
            PatientPaymentId = patientPaymentId,
            PaymentMethod = ElectronicInvoicePaymentMethod.CashOrTransfer
        });

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
        var settings = await _accounts.GetForInvoiceAsync(invoice);

        var outcome = await _provider.GetByIkeysAsync(settings, [invoice.Ikey]);
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
        var settings = await _accounts.GetForInvoiceAsync(invoice);

        var outcome = await _provider.GetPdfAsync(settings, invoice.Ikey);
        await LogAsync(invoice.ClinicBranchId, PdfOperation, outcome, 1);

        if (!outcome.Succeeded || outcome.Data == null)
        {
            throw Refusal(outcome.LogError);
        }

        return outcome.Data;
    }

    private async Task<ElectronicInvoiceDto> IssueLockedAsync(
        InvoiceSource source, EasyInvoiceSettings settings, IssueElectronicInvoiceDto input)
    {
        var existing = await _invoices.FirstOrDefaultAsync(x => x.Ikey == source.Ikey);
        if (existing != null)
        {
            existing.EnsureReissuable();
            if (existing.ProviderConfigId != settings.ConfigId
                || existing.Pattern != settings.Pattern
                || existing.Serial != settings.Serial)
            {
                existing.MoveTo(settings);
            }
        }

        await EnsureNotInvoicedTwiceAsync(source);

        var draft = await BuildDraftAsync(source, settings.VatRate, input);
        // Compared VAT included on both sides: the source is what was (or is to
        // be) paid, and the draft's Amount is what the invoice will ask for.
        if (draft.Amount > source.MaxAmount)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AmountExceedsSource)
                .WithData("Max", source.MaxAmount.ToString("N0"));
        }

        var xml = EasyInvoiceXmlBuilder.Build(draft);
        var outcome = input.Publish
            ? await _provider.ImportAndPublishAsync(settings, xml)
            : await _provider.ImportInvoiceAsync(settings, xml);
        await LogAsync(source.ClinicBranchId, input.Publish ? PublishOperation : ImportOperation,
            outcome, draft.Lines.Count);

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
            GuidGenerator.Create(), source.ClinicBranchId, source.PatientId, source.Payment?.Id,
            source.Payment?.TreatmentPlanId ?? source.Plan?.Id, settings, draft);
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

        await _accounts.RememberNumberingAsync(settings);
        return Map(invoice);
    }

    /// <summary>The provider is only ever sent VND at rate 1; the dialog's fields must agree.</summary>
    private static void EnsureVnd(IssueElectronicInvoiceDto input)
    {
        var currency = Blank(input.Currency);
        if ((currency != null && !string.Equals(currency, "VND", StringComparison.OrdinalIgnoreCase))
            || (input.ExchangeRate is { } rate && rate != 1m))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.CurrencyNotSupported);
        }
    }

    /// <summary>The suggested pair first, then what the branch has issued under, newest first.</summary>
    private async Task<List<ElectronicInvoiceNumberingDto>> NumberingsAsync(
        Guid clinicBranchId, EasyInvoiceSettings? suggested)
    {
        var query = (await _invoices.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == clinicBranchId)
            .OrderByDescending(x => x.CreationTime)
            .Select(x => new { x.Pattern, x.Serial })
            .Take(200);
        var issued = await AsyncExecuter.ToListAsync(query);

        var pairs = new List<ElectronicInvoiceNumberingDto>();
        if (Blank(suggested?.Pattern) is { } pattern)
        {
            pairs.Add(new ElectronicInvoiceNumberingDto { Pattern = pattern, Serial = suggested!.Serial });
        }

        foreach (var pair in issued.Where(x => !string.IsNullOrWhiteSpace(x.Pattern)))
        {
            if (!pairs.Any(p => p.Pattern == pair.Pattern))
            {
                pairs.Add(new ElectronicInvoiceNumberingDto { Pattern = pair.Pattern, Serial = pair.Serial });
            }
        }

        return pairs;
    }

    /// <summary>A slip billed whole cannot also be billed receipt by receipt, nor the reverse.</summary>
    private async Task EnsureNotInvoicedTwiceAsync(InvoiceSource source)
    {
        var clash = source.Plan != null
            ? await _invoices.AnyAsync(ElectronicInvoice.BillsSlipOtherWay(source.Plan.Id, wholeSlip: true))
            : source.Payment!.TreatmentPlanId is { } planId
              && await _invoices.AnyAsync(ElectronicInvoice.BillsSlipOtherWay(planId, wholeSlip: false));

        if (clash)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.SourceAlreadyInvoiced);
        }
    }

    /// <summary>The receipt or slip, branch-checked, with what bounds its invoice.</summary>
    private async Task<InvoiceSource> LoadSourceAsync(Guid? patientPaymentId, Guid? treatmentPlanId)
    {
        if (patientPaymentId.HasValue == treatmentPlanId.HasValue)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired);
        }

        if (patientPaymentId is { } paymentId)
        {
            var paymentQuery = await _payments.WithDetailsAsync(x => x.Lines);
            var payment = await AsyncExecuter.FirstOrDefaultAsync(paymentQuery.Where(x => x.Id == paymentId))
                ?? throw new EntityNotFoundException(typeof(PatientPayment), paymentId);
            await _branchAccess.CheckAsync(payment.ClinicBranchId);

            var plan = payment.TreatmentPlanId is { } id ? await LoadPlanAsync(id) : null;
            return new InvoiceSource(
                payment.ClinicBranchId, payment.PatientId, IkeyOf(payment.Id), payment.Amount,
                payment.Method == PaymentMethodKind.Cash
                    ? ElectronicInvoicePaymentMethod.Cash
                    : ElectronicInvoicePaymentMethod.Transfer,
                payment, null, plan);
        }

        var slip = await LoadPlanAsync(treatmentPlanId!.Value);
        await _branchAccess.CheckAsync(slip.BranchId);
        return new InvoiceSource(
            // VAT included: the slip is invoiced at what the patient pays for it.
            slip.BranchId, slip.PatientId, PlanIkeyOf(slip.Id), slip.PayableAmount,
            ElectronicInvoicePaymentMethod.CashOrTransfer, null, slip, slip);
    }

    private async Task<TreatmentPlan> LoadPlanAsync(Guid id)
    {
        var planQuery = await _plans.WithDetailsAsync(x => x.Services);
        return await AsyncExecuter.FirstOrDefaultAsync(planQuery.Where(x => x.Id == id))
            ?? throw new EntityNotFoundException(typeof(TreatmentPlan), id);
    }

    private async Task<ElectronicInvoiceDraft> BuildDraftAsync(
        InvoiceSource source, int defaultVatRate, IssueElectronicInvoiceDto input)
    {
        var patient = await _patients.GetAsync(source.PatientId);
        var lines = input.Lines.Count > 0
            ? input.Lines.Select(l => ElectronicInvoiceDraft.Line(
                l.Code.Trim(), l.Name.Trim(), l.Unit.Trim(), l.Quantity, l.UnitPrice,
                l.VatRate ?? defaultVatRate)).ToList()
            : await DefaultLinesAsync(source, defaultVatRate);

        var buyer = Blank(input.BuyerName) ?? patient.FullName;
        return new ElectronicInvoiceDraft
        {
            Ikey = source.Ikey,
            CustomerCode = patient.PatientCode,
            CustomerName = Blank(input.CompanyName) ?? buyer,
            BuyerName = buyer,
            CustomerAddress = Blank(input.Address) ?? patient.Contact?.Address ?? patient.OldAddress,
            // The draft showed the phone masked for an account with "Ẩn số điện
            // thoại" (Cụm 11 mục 9); the provider must get the real one.
            CustomerPhone = BlueDental.PatientManagement.PatientPhoneMask.Resolve(
                Blank(input.Phone), patient.Contact?.PhoneNumber) ?? patient.Contact?.PhoneNumber,
            CustomerTaxCode = Blank(input.TaxCode),
            PaymentMethod = input.PaymentMethod switch
            {
                ElectronicInvoicePaymentMethod.Cash => ElectronicInvoiceDraft.CashPaymentMethod,
                ElectronicInvoicePaymentMethod.Transfer => ElectronicInvoiceDraft.TransferPaymentMethod,
                _ => ElectronicInvoiceDraft.CashOrTransferPaymentMethod
            },
            ArisingDate = input.ArisingDate?.Date,
            VatRate = lines.Count > 0 ? lines[0].VatRate : defaultVatRate,
            Lines = lines
        }.Validated();
    }

    /// <summary>
    /// The lines the dialog opens with. A whole slip is billed as the reference
    /// bills it: one line "Kế hoạch điều trị DT…", unit Răng, quantity 1, at the
    /// slip's Thành tiền. A receipt bills each service for its share, named from
    /// Danh mục dịch vụ, or one line for the whole amount when they do not add up.
    /// </summary>
    private async Task<List<ElectronicInvoiceLine>> DefaultLinesAsync(InvoiceSource source, int vatRate)
    {
        if (source.Payment == null)
        {
            return SlipLines(source.Plan!, vatRate);
        }

        var parts = ReceiptParts(source);
        var lines = await NameLinesAsync(parts);

        if (lines.Count == 0 || lines.Sum(l => l.Amount) != source.MaxAmount)
        {
            // One line for the whole receipt, at the services' rate when they share one.
            var rates = parts.Select(p => RateOf(p.Service)).Distinct().ToList();
            var code = source.Payment.Code;
            lines =
            [
                ElectronicInvoiceDraft.LineFromGross(
                    code, L["Treatment:EInvoice:LineName", code], L["Treatment:EInvoice:DefaultUnit"],
                    1m, source.MaxAmount, rates.Count == 1 ? rates[0] : vatRate)
            ];
        }

        return lines;
    }

    /// <summary>The provider's VATRate for a slip line's stamped "% thuế"; an unstamped line is KCT.</summary>
    private static int RateOf(TreatmentService line) =>
        ElectronicInvoiceDraft.VatRateOf(line.TaxRate ?? ServiceTaxRate.NotTaxable);

    /// <summary>
    /// A whole slip, billed as the reference bills it — one line "Kế hoạch điều
    /// trị DT…", unit Răng — at its Thành tiền before VAT, with the services' VAT
    /// on top. Services of different "% thuế" make one such line per rate.
    /// </summary>
    private List<ElectronicInvoiceLine> SlipLines(TreatmentPlan plan, int fallbackRate)
    {
        var name = L["Treatment:Plan:ServiceName", plan.Code].Value;
        var unit = L["Treatment:Invoice:UnitTooth"].Value;
        var byRate = plan.Services
            .Where(line => plan.ChargedAmountOf(line) > 0m)
            .GroupBy(RateOf)
            .OrderByDescending(group => group.Key)
            .ToList();

        if (byRate.Count == 0)
        {
            return [ElectronicInvoiceDraft.Line(plan.Code, name, unit, 1m, plan.TotalAmount, fallbackRate)];
        }

        return byRate.Select(group => ElectronicInvoiceDraft.LineOf(
            plan.Code,
            byRate.Count == 1
                ? name
                : $"{name} ({(group.Key < 0 ? L["Treatment:Invoice:TaxExempt"].Value : $"VAT {group.Key}%")})",
            unit,
            1m,
            group.Sum(plan.ChargedAmountOf),
            group.Sum(plan.TaxAmountOf),
            group.Key)).ToList();
    }

    private static List<(TreatmentService Service, decimal Quantity, decimal Amount)> ReceiptParts(InvoiceSource source)
    {
        if (source.Slip == null)
        {
            return [];
        }

        var services = source.Slip.Services.ToDictionary(s => s.Id);
        return source.Payment!.Lines
            .Where(l => services.ContainsKey(l.TreatmentServiceId) && l.Amount > 0m)
            .Select(l => (services[l.TreatmentServiceId], 1m, l.Amount))
            .ToList();
    }

    /// <summary>
    /// One line per service of a receipt. What was collected is VAT included,
    /// so each line backs its service's VAT out of the amount rather than adding it.
    /// </summary>
    private async Task<List<ElectronicInvoiceLine>> NameLinesAsync(
        List<(TreatmentService Service, decimal Quantity, decimal Amount)> parts)
    {
        if (parts.Count == 0)
        {
            return [];
        }

        var serviceIds = parts.Select(p => p.Service.ServiceId).Distinct().ToList();
        var entries = (await _catalog.GetListAsync(c => serviceIds.Contains(c.Id))).ToDictionary(c => c.Id);
        var unit = L["Treatment:EInvoice:DefaultUnit"].Value;

        return parts.Select(p =>
        {
            entries.TryGetValue(p.Service.ServiceId, out var entry);
            return ElectronicInvoiceDraft.LineFromGross(
                entry?.Code ?? p.Service.Code,
                entry?.Name ?? p.Service.Code,
                entry?.Unit ?? unit,
                p.Quantity,
                p.Amount,
                RateOf(p.Service));
        }).ToList();
    }

    /// <summary>
    /// The call log survives the refusal that follows it: written in its own
    /// unit of work, so throwing afterwards rolls back the invoice row and
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

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static BusinessException Refusal(string? error) =>
        new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ProviderRefused)
            .WithData("Message", error ?? "no response");

    private static ElectronicInvoiceLineDto MapLine(ElectronicInvoiceLine line) => new()
    {
        Code = line.Code,
        Name = line.Name,
        Unit = line.Unit,
        Quantity = line.Quantity,
        UnitPrice = line.UnitPrice,
        Total = line.Total,
        VatRate = line.VatRate,
        TaxAmount = line.TaxAmount,
        Amount = line.Amount
    };

    private static ElectronicInvoiceDto Map(ElectronicInvoice invoice) => new()
    {
        Id = invoice.Id,
        ClinicBranchId = invoice.ClinicBranchId,
        PatientId = invoice.PatientId,
        PatientPaymentId = invoice.PatientPaymentId,
        TreatmentPlanId = invoice.TreatmentPlanId,
        ProviderConfigId = invoice.ProviderConfigId,
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
        PaymentMethod = invoice.PaymentMethod,
        ArisingDate = invoice.ArisingDate,
        LastSyncedAt = invoice.LastSyncedAt,
        LastError = invoice.LastError,
        CreationTime = invoice.CreationTime
    };

    /// <summary>
    /// What is being invoiced. <see cref="Plan"/> is the slip billed whole;
    /// <see cref="Slip"/> is the slip the lines are named from (a receipt's
    /// own slip too).
    /// </summary>
    private sealed record InvoiceSource(
        Guid ClinicBranchId,
        Guid PatientId,
        string Ikey,
        decimal MaxAmount,
        ElectronicInvoicePaymentMethod PaymentMethod,
        PatientPayment? Payment,
        TreatmentPlan? Plan,
        TreatmentPlan? Slip);
}
