using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// The hóa đơn điện tử of one receipt (Thanh toán row) or of a whole treatment
/// slip (the Hóa đơn dialog), and everything that happened to it (BA 2026-11-18):
/// <list type="number">
/// <item>Lưu Nháp keeps the dialog in BlueDental — <see cref="ElectronicInvoiceStatus.NotSent"/>, nothing sent.</item>
/// <item>Lưu sends it to EasyInvoice unsigned — <see cref="ElectronicInvoiceStatus.Draft"/>, "Chờ kiểm tra".
/// Lưu again while it waits rewrites the same draft at the provider.</item>
/// <item>The accountant signs it on the provider's portal; the sync reads it
/// back — <see cref="ElectronicInvoiceStatus.Published"/>, with its PDF.</item>
/// <item>Cancelled on the provider, it may go out again: the next round, under
/// a new key, on this same row, the cancelled round kept in <see cref="Attempts"/>.</item>
/// </list>
/// Money is copied at each save so the list reads without a provider round trip.
/// </summary>
public class ElectronicInvoice : FullAuditedAggregateRoot<Guid>
{
    public const string EasyInvoiceProvider = "EasyInvoice";
    public const int MaxProviderLength = 50;
    public const int MaxIkeyLength = 100;
    public const int MaxSourceKeyLength = 90;
    public const int MaxPatternLength = 20;
    public const int MaxSerialLength = 20;
    public const int MaxNoLength = 20;
    public const int MaxLookupCodeLength = 100;
    public const int MaxLinkLength = 500;
    public const int MaxCustomerNameLength = 200;
    public const int MaxErrorLength = 1000;
    public const int MaxPaymentMethodLength = 50;
    public const int MaxBlobNameLength = 200;

    /// <summary>
    /// The live invoices that bill a slip the other way from <paramref name="wholeSlip"/>:
    /// receipt by receipt when the slip is billed whole, and the reverse. One
    /// only saved in BlueDental, or cancelled, bills nothing, so it never stands in the way.
    /// </summary>
    public static Expression<Func<ElectronicInvoice, bool>> BillsSlipOtherWay(Guid treatmentPlanId, bool wholeSlip) =>
        wholeSlip
            ? x => x.TreatmentPlanId == treatmentPlanId && x.PatientPaymentId != null
                && x.Status != ElectronicInvoiceStatus.Cancelled && x.Status != ElectronicInvoiceStatus.NotSent
            : x => x.TreatmentPlanId == treatmentPlanId && x.PatientPaymentId == null
                && x.Status != ElectronicInvoiceStatus.Cancelled && x.Status != ElectronicInvoiceStatus.NotSent;

    /// <summary>The provider key of a round: the source's own key first, then <c>{key}-{round}</c>.</summary>
    public static string RoundKey(string sourceKey, int round) => round <= 1 ? sourceKey : $"{sourceKey}-{round}";

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }

    /// <summary>The receipt this invoice bills; null when it bills a whole slip.</summary>
    public Guid? PatientPaymentId { get; private set; }

    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>The branch account it went out under; null for the server-wide account or before it went out.</summary>
    public Guid? ProviderConfigId { get; private set; }

    public string Provider { get; private set; } = EasyInvoiceProvider;

    /// <summary>What the invoice is of — <c>bd-{receipt id}</c> or <c>bd-plan-{slip id}</c>; one row per source.</summary>
    public string SourceKey { get; private set; } = string.Empty;

    /// <summary>How many times it went out under a new key (0 while only saved); the current round is the last.</summary>
    public int Round { get; private set; }

    /// <summary>The provider's key of the current round (<see cref="RoundKey"/>).</summary>
    public string Ikey { get; private set; } = string.Empty;

    /// <summary>Mẫu số; blank until it goes out.</summary>
    public string Pattern { get; private set; } = string.Empty;

    public string? Serial { get; private set; }

    public ElectronicInvoiceStatus Status { get; private set; }

    /// <summary>The provider's raw <c>InvoiceStatus</c>, kept for diagnosis.</summary>
    public int? ProviderStatus { get; private set; }

    /// <summary>Số hóa đơn, once signed.</summary>
    public string? No { get; private set; }

    /// <summary>Mã tra cứu on the provider's public lookup page.</summary>
    public string? LookupCode { get; private set; }

    public string? LinkView { get; private set; }

    /// <summary>Pre-tax total.</summary>
    public decimal Total { get; private set; }

    public decimal TaxAmount { get; private set; }

    /// <summary>What the invoice bills, tax included.</summary>
    public decimal Amount { get; private set; }

    public string CustomerName { get; private set; } = string.Empty;

    /// <summary>"Tiền mặt" / "Chuyển khoản" / "TM/CK" as sent.</summary>
    public string PaymentMethod { get; private set; } = string.Empty;

    /// <summary>Ngày hóa đơn as sent; null when the provider stamped it.</summary>
    public DateTime? ArisingDate { get; private set; }

    /// <summary>
    /// The dialog as last saved or sent — buyer, lines, numbering — so it
    /// reopens as the cashier left it. Opaque here: the application layer
    /// owns its shape.
    /// </summary>
    public string? FormJson { get; private set; }

    /// <summary>When the current round was first heard signed; the cancel check looks back from it.</summary>
    public DateTimeOffset? SignedAt { get; private set; }

    public DateTimeOffset? LastSyncedAt { get; private set; }

    /// <summary>The provider's last refusal, cleared by the next success.</summary>
    public string? LastError { get; private set; }

    private readonly List<ElectronicInvoiceAttempt> _attempts = [];

    /// <summary>Every round sent, oldest first.</summary>
    public IReadOnlyCollection<ElectronicInvoiceAttempt> Attempts => _attempts.AsReadOnly();

    public ElectronicInvoiceAttempt? CurrentAttempt => _attempts.FirstOrDefault(a => a.Round == Round);

    /// <summary>The signed invoice's PDF, once the sync stored it.</summary>
    public string? PdfBlobName => CurrentAttempt?.PdfBlobName;

    /// <summary>Signed by the provider — the tax authority's record now.</summary>
    public bool IsSigned => Status is ElectronicInvoiceStatus.Published
        or ElectronicInvoiceStatus.Replaced or ElectronicInvoiceStatus.Adjusted;

    protected ElectronicInvoice() { }

    /// <summary>A source's invoice, not sent yet: the first Lưu Nháp or Lưu makes it.</summary>
    public static ElectronicInvoice Open(
        Guid id,
        Guid clinicBranchId,
        Guid patientId,
        Guid? patientPaymentId,
        Guid? treatmentPlanId,
        string sourceKey)
    {
        Check.NotNullOrWhiteSpace(sourceKey, nameof(sourceKey), MaxSourceKeyLength);
        if (patientPaymentId == null && treatmentPlanId == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired);
        }

        return new ElectronicInvoice
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientId = patientId,
            PatientPaymentId = patientPaymentId,
            TreatmentPlanId = treatmentPlanId,
            SourceKey = sourceKey,
            Ikey = RoundKey(sourceKey, 1),
            Status = ElectronicInvoiceStatus.NotSent
        };
    }

    /// <summary>
    /// Lưu Nháp: the dialog kept in BlueDental, nothing sent. Allowed before
    /// the invoice goes out and after the provider cancelled it (to prepare the
    /// next round); one waiting at the provider is changed by Lưu, which re-sends.
    /// </summary>
    public void SaveForm(string formJson, ElectronicInvoiceDraft figures)
    {
        if (IsSigned)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished);
        }

        if (Status == ElectronicInvoiceStatus.Draft)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AlreadySent);
        }

        if (Status == ElectronicInvoiceStatus.Cancelled)
        {
            ForgetProviderCopy();
            Ikey = RoundKey(SourceKey, Round + 1);
        }

        Status = ElectronicInvoiceStatus.NotSent;
        FormJson = formJson;
        TakeAmounts(figures);
    }

    /// <summary>
    /// The key the next Lưu goes out under: the waiting draft's own (the
    /// provider overwrites it), or a new round's when there is none or the
    /// last was cancelled. A signed invoice is never sent again.
    /// </summary>
    public string IkeyForSend()
    {
        if (IsSigned)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished);
        }

        return Status == ElectronicInvoiceStatus.Draft ? Ikey : RoundKey(SourceKey, Round + 1);
    }

    /// <summary>
    /// Lưu went through: the provider holds <paramref name="draft"/> unsigned
    /// under <see cref="IkeyForSend"/>, filed under <paramref name="settings"/>.
    /// </summary>
    public void Sent(EasyInvoiceSettings settings, ElectronicInvoiceDraft draft, string formJson, DateTimeOffset at)
    {
        var key = IkeyForSend();
        if (!string.Equals(draft.Ikey, key, StringComparison.Ordinal))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "The draft was built for another round.");
        }

        Check.NotNullOrWhiteSpace(settings.Pattern, nameof(settings.Pattern), MaxPatternLength);
        var pattern = settings.Pattern;
        var serial = Clip(settings.Serial, MaxSerialLength);

        if (Status == ElectronicInvoiceStatus.Draft && CurrentAttempt is { } waiting)
        {
            waiting.Resent(pattern, serial, draft.Amount, at);
        }
        else if (Status == ElectronicInvoiceStatus.Draft)
        {
            // Sent before rounds were kept: its first round is recorded now.
            _attempts.Add(new ElectronicInvoiceAttempt(Round, key, pattern, serial, draft.Amount, at));
        }
        else
        {
            ForgetProviderCopy();
            Round++;
            _attempts.Add(new ElectronicInvoiceAttempt(Round, key, pattern, serial, draft.Amount, at));
        }

        Ikey = key;
        ProviderConfigId = settings.ConfigId;
        Pattern = pattern;
        Serial = serial;
        Status = ElectronicInvoiceStatus.Draft;
        FormJson = formJson;
        TakeAmounts(draft);
        LastError = null;
    }

    /// <summary>
    /// What the provider says about the current round now, and what that
    /// changed: signed on the portal, or cancelled there.
    /// </summary>
    public ElectronicInvoiceChange ApplyProviderSummary(ProviderInvoiceSummary summary, DateTimeOffset at)
    {
        if (Status == ElectronicInvoiceStatus.NotSent
            || !string.Equals(summary.Ikey, Ikey, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "The provider answered about a different invoice.");
        }

        var wasSigned = IsSigned;
        var wasCancelled = Status == ElectronicInvoiceStatus.Cancelled;

        Status = summary.Status;
        ProviderStatus = summary.InvoiceStatus;
        if (!string.IsNullOrWhiteSpace(summary.Pattern))
        {
            Pattern = Clip(summary.Pattern, MaxPatternLength)!;
        }

        Serial = Clip(summary.Serial, MaxSerialLength);
        No = summary.No == "0" ? null : Clip(summary.No, MaxNoLength);
        LookupCode = Clip(summary.LookupCode, MaxLookupCodeLength);
        LinkView = Clip(summary.LinkView, MaxLinkLength);
        LastSyncedAt = at;
        LastError = null;
        CurrentAttempt?.Heard(Status, No, at);
        if (IsSigned && SignedAt == null)
        {
            SignedAt = at;
        }

        if (Status == ElectronicInvoiceStatus.Cancelled && !wasCancelled)
        {
            return ElectronicInvoiceChange.Cancelled;
        }

        return IsSigned && !wasSigned ? ElectronicInvoiceChange.Signed : ElectronicInvoiceChange.None;
    }

    /// <summary>The signed invoice's PDF, stored by the sync.</summary>
    public void AttachPdf(string blobName)
    {
        Check.NotNullOrWhiteSpace(blobName, nameof(blobName), MaxBlobNameLength);
        if (CurrentAttempt is not { } current || !IsSigned)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "Only a signed invoice has a PDF to keep.");
        }

        current.AttachPdf(blobName);
    }

    public void RecordFailure(string? error, DateTimeOffset at)
    {
        LastError = Clip(error, MaxErrorLength);
        LastSyncedAt = at;
    }

    /// <summary>
    /// The receipt behind an invoice that was ever signed cannot be deleted:
    /// the money is on a tax document, cancelled or not. One only saved, or
    /// still waiting unsigned, may go, and its row goes with it.
    /// </summary>
    public void EnsureReceiptRemovable()
    {
        if (Status is not (ElectronicInvoiceStatus.NotSent or ElectronicInvoiceStatus.Draft)
            || _attempts.Any(a => a.SignedAt != null))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ReceiptInvoiced)
                .WithData("No", No ?? _attempts.LastOrDefault(a => a.No != null)?.No ?? Ikey);
        }
    }

    private void TakeAmounts(ElectronicInvoiceDraft draft)
    {
        Total = draft.Total;
        TaxAmount = draft.TaxAmount;
        Amount = draft.Amount;
        CustomerName = Clip(draft.CustomerName, MaxCustomerNameLength) ?? string.Empty;
        PaymentMethod = Clip(draft.PaymentMethod, MaxPaymentMethodLength) ?? string.Empty;
        ArisingDate = draft.ArisingDate;
    }

    /// <summary>The cancelled round's number and links belong to its attempt now, not to what comes next.</summary>
    private void ForgetProviderCopy()
    {
        ProviderStatus = null;
        No = null;
        LookupCode = null;
        LinkView = null;
        SignedAt = null;
    }

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}

/// <summary>What one provider reading changed, for the work that follows it (PDF, YC-HD, screens).</summary>
public enum ElectronicInvoiceChange
{
    None = 0,
    Signed = 1,
    Cancelled = 2
}
