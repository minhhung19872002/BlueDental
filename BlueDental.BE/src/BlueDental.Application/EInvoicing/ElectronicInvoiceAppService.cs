using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.ClinicIntegration;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Printing;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Authorization;
using Volo.Abp.BlobStoring;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Uow;
using Volo.Abp.Users;

namespace BlueDental.EInvoicing;

/// <summary>
/// Hóa đơn điện tử, from a receipt (Thanh toán row) or a whole slip (the
/// Hóa đơn dialog of the plan).
///
/// One source → one invoice row, keyed <c>bd-{receipt id}</c> or
/// <c>bd-plan-{slip id}</c> (BA 2026-11-18): Lưu Nháp keeps the dialog here;
/// Lưu sends it to EasyInvoice unsigned, and a second Lưu rewrites that same
/// draft there; the accountant signs on the provider's portal and
/// <see cref="ElectronicInvoiceSync"/> reads it back. Cancelled there, the next
/// Lưu sends a new round on the same row. A slip is invoiced either whole or
/// receipt by receipt, never both. The invoice goes out under the branch's own account
/// (Công cụ › Hóa đơn › Cấu hình), else the server-wide one. Every provider
/// call is recorded in the integration call log (CLAUDE.md §9), shape only —
/// never the body, which names the patient, nor the header, which carries
/// the account password.
/// </summary>
[Authorize]
public class ElectronicInvoiceAppService : BlueDentalAppService, IElectronicInvoiceAppService
{
    /// <summary>
    /// Keys with an issue in flight on this host: a double click must not race
    /// two saves or provider calls. The unique SourceKey and Ikey indexes back
    /// this across hosts.
    /// </summary>
    private static readonly ConcurrentDictionary<string, byte> InFlight = new(StringComparer.Ordinal);

    private readonly IRepository<ElectronicInvoice, Guid> _invoices;
    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<CatalogEntry, Guid> _catalog;
    private readonly ElectronicInvoiceSync _sync;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IEasyInvoiceClient _provider;
    private readonly EasyInvoiceSettingsResolver _accounts;
    private readonly IOptions<EasyInvoiceOptions> _options;

    public ElectronicInvoiceAppService(
        IRepository<ElectronicInvoice, Guid> invoices,
        IRepository<PatientPayment, Guid> payments,
        IRepository<TreatmentPlan, Guid> plans,
        IRepository<Patient, Guid> patients,
        IRepository<CatalogEntry, Guid> catalog,
        ElectronicInvoiceSync sync,
        BranchAccessChecker branchAccess,
        IEasyInvoiceClient provider,
        EasyInvoiceSettingsResolver accounts,
        IOptions<EasyInvoiceOptions> options)
    {
        _invoices = invoices;
        _payments = payments;
        _plans = plans;
        _patients = patients;
        _catalog = catalog;
        _sync = sync;
        _branchAccess = branchAccess;
        _provider = provider;
        _accounts = accounts;
        _options = options;
    }

    /// <summary>The key of a receipt's invoice row, and of its first round at the provider.</summary>
    public static string IkeyOf(Guid patientPaymentId) => $"bd-{patientPaymentId:N}";

    /// <summary>The key of a whole slip's invoice row.</summary>
    public static string PlanIkeyOf(Guid treatmentPlanId) => $"bd-plan-{treatmentPlanId:N}";

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<ElectronicInvoiceDraftDto> GetDraftAsync(GetElectronicInvoiceDraftInput input)
    {
        var source = await LoadSourceAsync(input.PatientPaymentId, input.TreatmentPlanId);
        var account = await _accounts.FindForBranchAsync(source.ClinicBranchId);
        var vatRate = account?.Settings.VatRate ?? _options.Value.VatRate;
        var patient = await _patients.GetAsync(source.PatientId);
        var existing = await FindAsync(source);

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
            Existing = existing == null ? null : Map(existing),
            SavedForm = FormFrom(existing?.FormJson)
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
        EasyInvoiceSettings? settings = null;
        if (input.Send)
        {
            EnsureBuyer(input);
            settings = await SettingsForSendAsync(source, input);
        }

        if (!InFlight.TryAdd(source.Ikey, 0))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.IssueInProgress);
        }

        try
        {
            return settings == null
                ? await SaveFormLockedAsync(source, input)
                : await SendLockedAsync(source, settings, input);
        }
        finally
        {
            InFlight.TryRemove(source.Ikey, out _);
        }
    }

    /// <summary>Lưu Nháp of a receipt's invoice with the prefilled lines.</summary>
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
        if (invoice.Status == ElectronicInvoiceStatus.NotSent)
        {
            // Only saved here: the provider has nothing to say about it.
            return Map(invoice);
        }

        var settings = await _accounts.GetForInvoiceAsync(invoice);
        var outcome = await _sync.RefreshAsync(settings, [invoice], UtcNow());
        if (!outcome.Succeeded)
        {
            throw EasyInvoiceRefusal.From(outcome.ErrorCode, outcome.Error);
        }

        return Map(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<byte[]> GetPdfAsync(Guid id)
    {
        var invoice = await _invoices.GetAsync(id);
        await _branchAccess.CheckAsync(invoice.ClinicBranchId);

        // The signed PDF the sync kept is the one the customer got; the
        // provider renders the others (a draft, a cancelled round) on demand.
        if (invoice.PdfBlobName is { } blobName
            && await LazyServiceProvider.LazyGetRequiredService<IBlobContainer>().GetAllBytesOrNullAsync(blobName)
                is { Length: > 0 } kept)
        {
            return kept;
        }

        var settings = await _accounts.GetForInvoiceAsync(invoice);
        var outcome = await _provider.GetPdfAsync(settings, invoice.Ikey);
        await _sync.LogAsync(invoice.ClinicBranchId, ElectronicInvoiceSync.PdfOperation, outcome, 1);

        if (!outcome.Succeeded || outcome.Data == null)
        {
            throw EasyInvoiceRefusal.From(outcome.ErrorCode, outcome.Error);
        }

        return outcome.Data;
    }

    /// <summary>
    /// PHIẾU THU for Lưu, whether or not an e-invoice goes out with it,
    /// and for Lưu on "Tạo phiếu thanh toán", which prints the receipt it just
    /// wrote while it is still "Chưa thanh toán" (owner 2026-10-12). So whoever
    /// may write a receipt (payment.create) or finalize one may print it.
    /// </summary>
    public async Task<byte[]> RenderReceiptAsync(RenderPaymentReceiptDto input)
    {
        if (!await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.Payment.Create)
            && !await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.Payment.Finalize))
        {
            throw new AbpAuthorizationException();
        }

        var source = await LoadSourceAsync(input.PatientPaymentId, input.TreatmentPlanId, allowPending: true);
        if (source.Payment is { Kind: not PatientPaymentKind.Payment })
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ReceiptNotInvoiceable);
        }

        var account = await _accounts.FindForBranchAsync(source.ClinicBranchId);
        var vatRate = account?.Settings.VatRate ?? _options.Value.VatRate;
        var lines = await LinesOfAsync(source, vatRate, input.Lines);
        var paid = lines.Sum(l => l.Amount);
        if (paid > source.MaxAmount)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AmountExceedsSource)
                .WithData("Max", source.MaxAmount.ToString("N0"));
        }

        var patient = await _patients.GetAsync(source.PatientId);
        var sheet = await SheetOfAsync(source);
        var content = new PaymentReceiptContent(
            CustomerName: Blank(input.BuyerName) ?? patient.FullName,
            TreatmentWork: string.Join(", ", (sheet?.Lines.Select(l => l.Name).ToList()
                ?? await TreatmentWorkAsync(source, lines)).Distinct()),
            PaidAmount: paid,
            // A receipt's Số tiền còn lại is its sheet's — after the other đợt
            // and every relief (P2910) — as the exported PDF and the iPad say.
            SlipTotal: sheet != null
                ? sheet.Remaining + sheet.Amount
                : source.Slip?.PayableAmount ?? source.MaxAmount,
            PayerName: patient.FullName,
            IssueDate: input.ArisingDate is { } day
                ? DateOnly.FromDateTime(day)
                : ClinicCalendar.DateOf(DateTimeOffset.UtcNow),
            CashierName: await CashierNameAsync());

        var docx = DocxTemplate.Fill(
            await LazyServiceProvider.LazyGetRequiredService<PaymentReceiptTemplate>().LoadAsync(),
            content.ToPlaceholders());
        docx = source.Payment is { RedInvoiceRequested: true } payment
            ? await WithInvoiceRequestQrAsync(docx, payment)
            : PaymentReceiptQr.Leave(docx);

        return await LazyServiceProvider.LazyGetRequiredService<IDocxPdfConverter>()
            .ConvertAsync(docx, "phieu-thu.docx");
    }

    /// <summary>
    /// "Xuất hóa đơn đỏ" ticked: the receipt carries a QR to the THÔNG TIN XUẤT
    /// HÓA ĐƠN form for this receipt (BA 2026-10-12), in the box the template
    /// draws for it.
    /// </summary>
    private async Task<byte[]> WithInvoiceRequestQrAsync(byte[] docx, PatientPayment payment)
    {
        var sources = LazyServiceProvider.LazyGetRequiredService<InvoiceRequestSources>();
        var link = await sources.EnsureLinkAsync(payment, GuidGenerator.Create());
        return PaymentReceiptQr.Place(docx, sources.PublicUrlOf(link));
    }

    /// <summary>The lines ticked in the dialog, priced VAT included as the invoice would be.</summary>
    private async Task<List<ElectronicInvoiceLine>> LinesOfAsync(
        InvoiceSource source, int defaultVatRate, List<ElectronicInvoiceLineInput> input) =>
        input.Count > 0
            ? input.Select(l => ElectronicInvoiceDraft.Line(
                l.Code.Trim(), l.Name.Trim(), l.Unit.Trim(), l.Quantity, l.UnitPrice,
                l.VatRate ?? defaultVatRate)).ToList()
            : await DefaultLinesAsync(source, defaultVatRate);

    /// <summary>
    /// Công việc điều trị: a whole slip is billed as one "Kế hoạch điều trị DT…"
    /// line, so the receipt names the slip's services instead; a receipt names
    /// its own lines.
    /// </summary>
    private async Task<List<string>> TreatmentWorkAsync(InvoiceSource source, List<ElectronicInvoiceLine> lines)
    {
        if (source.Plan == null)
        {
            return lines.Select(l => l.Name).ToList();
        }

        var charged = source.Plan.Services.Where(s => source.Plan.ChargedAmountOf(s) > 0m).ToList();
        var serviceIds = charged.Select(s => s.ServiceId).Distinct().ToList();
        var names = (await _catalog.GetListAsync(c => serviceIds.Contains(c.Id))).ToDictionary(c => c.Id, c => c.Name);
        return charged.Select(s => names.GetValueOrDefault(s.ServiceId) ?? s.Code).ToList();
    }

    /// <summary>
    /// The PHIẾU THU content of a slip's receipt — its "Tên trên phiếu" and
    /// Số tiền còn lại; none for a whole slip or a receipt without one.
    /// </summary>
    private async Task<PaymentReceiptSnapshot?> SheetOfAsync(InvoiceSource source)
    {
        if (source.Payment is not { TreatmentPlanId: not null } payment)
        {
            return null;
        }

        var sheet = await LazyServiceProvider.LazyGetRequiredService<PaymentReceiptContents>().ContentOfAsync(payment);
        return sheet.Lines.Count > 0 ? sheet : null;
    }

    /// <summary>Người lập phiếu: the signed-in user's full name, as the staff screens show it.</summary>
    private async Task<string> CashierNameAsync()
    {
        var userId = CurrentUser.GetId();
        var user = await LazyServiceProvider.LazyGetRequiredService<IIdentityUserRepository>().FindAsync(userId);
        if (user == null)
        {
            return CurrentUser.UserName ?? string.Empty;
        }

        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }

    /// <summary>The account Lưu sends under, with the Mẫu số / ký hiệu picked in the dialog.</summary>
    private async Task<EasyInvoiceSettings> SettingsForSendAsync(InvoiceSource source, IssueElectronicInvoiceDto input)
    {
        var account = await _accounts.GetForBranchAsync(source.ClinicBranchId);
        var pattern = Blank(input.Pattern);
        var settings = pattern == null
            ? account
            : account with { Pattern = pattern, Serial = Blank(input.Serial) };
        if (string.IsNullOrWhiteSpace(settings.Pattern))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.PatternRequired);
        }

        return settings;
    }

    /// <summary>Lưu Nháp: the dialog kept as it is, nothing sent, nothing required.</summary>
    private async Task<ElectronicInvoiceDto> SaveFormLockedAsync(InvoiceSource source, IssueElectronicInvoiceDto input)
    {
        var existing = await FindAsync(source);
        await EnsureNotInvoicedTwiceAsync(source);

        var account = await _accounts.FindForBranchAsync(source.ClinicBranchId);
        var vatRate = account?.Settings.VatRate ?? _options.Value.VatRate;
        var figures = await BuildDraftAsync(source, vatRate, input, source.Ikey, validated: false);

        var invoice = existing ?? OpenFor(source);
        invoice.SaveForm(FormOf(input), figures);
        await SaveAsync(invoice, isNew: existing == null);
        return Map(invoice);
    }

    /// <summary>
    /// Lưu: the invoice goes to EasyInvoice unsigned — "Chờ kiểm tra" — for the
    /// accountant to sign on the provider's portal. While it waits, Lưu again
    /// rewrites the same draft there; after a cancel it goes out as a new round.
    /// </summary>
    private async Task<ElectronicInvoiceDto> SendLockedAsync(
        InvoiceSource source, EasyInvoiceSettings settings, IssueElectronicInvoiceDto input)
    {
        var existing = await FindAsync(source);
        var ikey = existing?.IkeyForSend() ?? ElectronicInvoice.RoundKey(source.Ikey, 1);
        await EnsureNotInvoicedTwiceAsync(source);

        var draft = await BuildDraftAsync(source, settings.VatRate, input, ikey, validated: true);
        // Compared VAT included on both sides: the source is what was (or is to
        // be) paid, and the draft's Amount is what the invoice will ask for.
        if (draft.Amount > source.MaxAmount)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AmountExceedsSource)
                .WithData("Max", source.MaxAmount.ToString("N0"));
        }

        var outcome = await _provider.ImportInvoiceAsync(settings, EasyInvoiceXmlBuilder.Build(draft));
        await _sync.LogAsync(source.ClinicBranchId, ElectronicInvoiceSync.ImportOperation, outcome, draft.Lines.Count);

        var now = UtcNow();
        if (!outcome.Succeeded)
        {
            // Nothing changed at the provider: the row (if any) stays as it was,
            // and the refusal goes under the box it is about.
            throw EasyInvoiceRefusal.From(outcome.ErrorCode, outcome.Error);
        }

        var invoice = existing ?? OpenFor(source);
        invoice.Sent(settings, draft, FormOf(input), now);
        var summary = outcome.Data?.FirstOrDefault(s =>
            string.Equals(s.Ikey, draft.Ikey, StringComparison.OrdinalIgnoreCase));
        if (summary != null)
        {
            await _sync.HeardAsync(settings, invoice, invoice.ApplyProviderSummary(summary, now), now);
        }

        await SaveAsync(invoice, isNew: existing == null);
        await _accounts.RememberNumberingAsync(settings);
        await _sync.StartRequestsAsync(invoice, CurrentUser.GetId());
        return Map(invoice);
    }

    private Task<ElectronicInvoice?> FindAsync(InvoiceSource source) =>
        _invoices.FirstOrDefaultAsync(x => x.SourceKey == source.Ikey);

    private ElectronicInvoice OpenFor(InvoiceSource source) => ElectronicInvoice.Open(
        GuidGenerator.Create(), source.ClinicBranchId, source.PatientId, source.Payment?.Id,
        source.Payment?.TreatmentPlanId ?? source.Plan?.Id, source.Ikey);

    private async Task SaveAsync(ElectronicInvoice invoice, bool isNew)
    {
        if (isNew)
        {
            await _invoices.InsertAsync(invoice);
        }
        else
        {
            await _invoices.UpdateAsync(invoice);
        }
    }

    private static readonly JsonSerializerOptions FormJsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The dialog as stored on the row; only BlueDental reads it back.</summary>
    private static string FormOf(IssueElectronicInvoiceDto input) => JsonSerializer.Serialize(input, FormJsonOptions);

    private static IssueElectronicInvoiceDto? FormFrom(string? formJson)
    {
        if (string.IsNullOrWhiteSpace(formJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<IssueElectronicInvoiceDto>(formJson, FormJsonOptions);
        }
        catch (JsonException)
        {
            // A form saved under an older shape just opens with the prefilled values.
            return null;
        }
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

    /// <summary>
    /// "Xuất hóa đơn đỏ" (BA): what goes to the provider must carry Tên khách
    /// hàng, Mã số thuế, Số ĐT and Email as typed — no fallback to the patient
    /// record. Lưu Nháp sends nothing and checks none of it.
    /// </summary>
    private static void EnsureBuyer(IssueElectronicInvoiceDto input)
    {
        // Địa chỉ: EasyInvoice refuses a buyer with a Mã số thuế and no address.
        if (Blank(input.BuyerName) == null || Blank(input.TaxCode) == null || Blank(input.Address) == null
            || Blank(input.Phone) == null || Blank(input.Email) == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.BuyerDetailsRequired);
        }

        // EasyInvoice refuses a tax code of any other shape (129); say so
        // before the call, under the box it is about.
        if (Blank(input.TaxCode) is { } taxCode && !BuyerTaxCode.IsValid(taxCode))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidBuyerTaxCode)
                .WithData(EasyInvoiceRefusal.FieldKey, "taxCode");
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
    private async Task<InvoiceSource> LoadSourceAsync(
        Guid? patientPaymentId,
        Guid? treatmentPlanId,
        bool allowPending = false)
    {
        if (patientPaymentId.HasValue == treatmentPlanId.HasValue)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired);
        }

        if (patientPaymentId is { } paymentId)
        {
            PatientPayment payment;
            using (DataFilter.Disable<ISettleable>())
            {
                var paymentQuery = await _payments.WithDetailsAsync(x => x.Lines);
                payment = await AsyncExecuter.FirstOrDefaultAsync(paymentQuery.Where(x => x.Id == paymentId))
                    ?? throw new EntityNotFoundException(typeof(PatientPayment), paymentId);
            }

            await _branchAccess.CheckAsync(payment.ClinicBranchId);

            // A receipt not yet "Đã thanh toán" has no money behind it: no
            // e-invoice until it is confirmed (BA 2026-10-08). Its PHIẾU THU may
            // be printed, right after Lưu (owner 2026-10-12).
            if (!payment.IsCompleted && !allowPending)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Billing.PaymentNotCompleted);
            }

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
        var settled = await SettlementOfAsync(slip);
        return new InvoiceSource(
            // VAT included: the slip is invoiced at what the patient pays for it,
            // less what its paid receipts let it off (P2910).
            slip.BranchId, slip.PatientId, PlanIkeyOf(slip.Id), slip.PayableAmount - slip.ReliefOffPayable(settled),
            ElectronicInvoicePaymentMethod.CashOrTransfer, null, slip, slip, settled);
    }

    /// <summary>What the slip's paid receipts did to each of its lines.</summary>
    private async Task<Dictionary<Guid, LineSettlement>> SettlementOfAsync(TreatmentPlan slip)
    {
        var paymentQuery = await _payments.WithDetailsAsync(x => x.Lines);
        var payments = await AsyncExecuter.ToListAsync(paymentQuery.Where(x => x.TreatmentPlanId == slip.Id));
        return LineSettlement.Of(slip, payments);
    }

    private async Task<TreatmentPlan> LoadPlanAsync(Guid id)
    {
        var planQuery = await _plans.WithDetailsAsync(x => x.Services);
        return await AsyncExecuter.FirstOrDefaultAsync(planQuery.Where(x => x.Id == id))
            ?? throw new EntityNotFoundException(typeof(TreatmentPlan), id);
    }

    /// <summary>
    /// The invoice the dialog describes, under <paramref name="ikey"/>. Only
    /// what is sent is <paramref name="validated"/>: Lưu Nháp keeps whatever
    /// the cashier has so far.
    /// </summary>
    private async Task<ElectronicInvoiceDraft> BuildDraftAsync(
        InvoiceSource source, int defaultVatRate, IssueElectronicInvoiceDto input, string ikey, bool validated)
    {
        var patient = await _patients.GetAsync(source.PatientId);
        var lines = await LinesOfAsync(source, defaultVatRate, input.Lines);

        var buyer = Blank(input.BuyerName) ?? patient.FullName;
        var draft = new ElectronicInvoiceDraft
        {
            Ikey = ikey,
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
        };
        return validated ? draft.Validated() : draft;
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
            return SlipLines(source.Plan!, source.Settled ?? new Dictionary<Guid, LineSettlement>(), vatRate);
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
    /// on top. Services of different "% thuế" make one such line per rate. What
    /// paid receipts let a line off (P2910) comes off before its VAT.
    /// </summary>
    private List<ElectronicInvoiceLine> SlipLines(
        TreatmentPlan plan, IReadOnlyDictionary<Guid, LineSettlement> settled, int fallbackRate)
    {
        decimal ReliefOf(TreatmentService line) => settled.GetValueOrDefault(line.Id, LineSettlement.None).Relief;

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
            group.Sum(line => plan.ChargedAmountOf(line, ReliefOf(line))),
            group.Sum(line => plan.TaxAmountOf(line, ReliefOf(line))),
            group.Key)).ToList();
    }

    private static List<(TreatmentService Service, decimal Quantity, decimal Amount, decimal? Tax)> ReceiptParts(
        InvoiceSource source)
    {
        if (source.Slip == null)
        {
            return [];
        }

        var services = source.Slip.Services.ToDictionary(s => s.Id);
        return source.Payment!.Lines
            .Where(l => services.ContainsKey(l.TreatmentServiceId) && l.Amount > 0m)
            .Select(l => (services[l.TreatmentServiceId], 1m, l.Amount, l.TaxAmount))
            .ToList();
    }

    /// <summary>
    /// One line per service of a receipt. What was collected is VAT included,
    /// so each line takes its VAT out of the amount rather than adding it: the
    /// VAT the đợt stored (P2910), so the đợt' invoices add up to the line's
    /// VAT, or — on a receipt from before — backed out at the service's rate.
    /// </summary>
    private async Task<List<ElectronicInvoiceLine>> NameLinesAsync(
        List<(TreatmentService Service, decimal Quantity, decimal Amount, decimal? Tax)> parts)
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
            var code = entry?.Code ?? p.Service.Code;
            var name = entry?.Name ?? p.Service.Code;
            return p.Tax is { } tax
                ? ElectronicInvoiceDraft.LineOf(
                    code, name, entry?.Unit ?? unit, p.Quantity, p.Amount - tax, tax, RateOf(p.Service))
                : ElectronicInvoiceDraft.LineFromGross(
                    code, name, entry?.Unit ?? unit, p.Quantity, p.Amount, RateOf(p.Service));
        }).ToList();
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
        SourceKey = invoice.SourceKey,
        Round = invoice.Round,
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
        SignedAt = invoice.SignedAt,
        HasPdf = invoice.PdfBlobName != null,
        LastSyncedAt = invoice.LastSyncedAt,
        LastError = invoice.LastError,
        CreationTime = invoice.CreationTime,
        Attempts = invoice.Attempts.OrderBy(x => x.Round).Select(x => new ElectronicInvoiceAttemptDto
        {
            Round = x.Round,
            Ikey = x.Ikey,
            Pattern = x.Pattern,
            Serial = x.Serial,
            Status = x.Status,
            No = x.No,
            Amount = x.Amount,
            SentAt = x.SentAt,
            SignedAt = x.SignedAt,
            CancelledAt = x.CancelledAt
        }).ToList()
    };

    // Postgres keeps timestamptz in UTC only; Clock.Now is local unless the clock is set to UTC.
    private DateTimeOffset UtcNow() => new(Clock.Now.ToUniversalTime(), TimeSpan.Zero);

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
        TreatmentPlan? Slip,
        IReadOnlyDictionary<Guid, LineSettlement>? Settled = null);
}
