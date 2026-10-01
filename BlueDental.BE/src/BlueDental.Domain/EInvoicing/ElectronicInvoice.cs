using System;
using System.Linq.Expressions;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// One hóa đơn điện tử BlueDental created at the provider — for one receipt
/// (Thanh toán row) or for a whole treatment slip (the Hóa đơn dialog).
///
/// The row is BlueDental's memory of the provider's invoice: its key, the
/// account and pattern it was filed under and the last status heard. Money is
/// copied at issue time so the list reads without a provider round trip. One
/// source gives at most one invoice; re-issuing a draft overwrites it at the
/// provider under the same key.
/// </summary>
public class ElectronicInvoice : FullAuditedAggregateRoot<Guid>
{
    public const string EasyInvoiceProvider = "EasyInvoice";
    public const int MaxProviderLength = 50;
    public const int MaxIkeyLength = 100;
    public const int MaxPatternLength = 20;
    public const int MaxSerialLength = 20;
    public const int MaxNoLength = 20;
    public const int MaxLookupCodeLength = 100;
    public const int MaxLinkLength = 500;
    public const int MaxCustomerNameLength = 200;
    public const int MaxErrorLength = 1000;
    public const int MaxPaymentMethodLength = 50;

    /// <summary>
    /// The live invoices that bill a slip the other way from <paramref name="wholeSlip"/>:
    /// receipt by receipt when the slip is billed whole, and the reverse. A
    /// cancelled invoice bills nothing any more, so it never stands in the way.
    /// </summary>
    public static Expression<Func<ElectronicInvoice, bool>> BillsSlipOtherWay(Guid treatmentPlanId, bool wholeSlip) =>
        wholeSlip
            ? x => x.TreatmentPlanId == treatmentPlanId && x.PatientPaymentId != null
                && x.Status != ElectronicInvoiceStatus.Cancelled
            : x => x.TreatmentPlanId == treatmentPlanId && x.PatientPaymentId == null
                && x.Status != ElectronicInvoiceStatus.Cancelled;

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }

    /// <summary>The receipt this invoice bills; null when it bills a whole slip.</summary>
    public Guid? PatientPaymentId { get; private set; }

    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>The branch account it went out under; null for the server-wide account.</summary>
    public Guid? ProviderConfigId { get; private set; }

    public string Provider { get; private set; } = EasyInvoiceProvider;

    /// <summary>The provider's idempotency key — <c>bd-{receipt id}</c> or <c>bd-plan-{slip id}</c>.</summary>
    public string Ikey { get; private set; } = string.Empty;

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

    public DateTimeOffset? LastSyncedAt { get; private set; }

    /// <summary>The provider's last refusal, cleared by the next success.</summary>
    public string? LastError { get; private set; }

    protected ElectronicInvoice() { }

    public static ElectronicInvoice Create(
        Guid id,
        Guid clinicBranchId,
        Guid patientId,
        Guid? patientPaymentId,
        Guid? treatmentPlanId,
        EasyInvoiceSettings settings,
        ElectronicInvoiceDraft draft)
    {
        Check.NotNullOrWhiteSpace(draft.Ikey, nameof(draft.Ikey), MaxIkeyLength);
        Check.NotNullOrWhiteSpace(settings.Pattern, nameof(settings.Pattern), MaxPatternLength);
        if (patientPaymentId == null && treatmentPlanId == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.SourceRequired);
        }

        var invoice = new ElectronicInvoice
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientId = patientId,
            PatientPaymentId = patientPaymentId,
            TreatmentPlanId = treatmentPlanId,
            ProviderConfigId = settings.ConfigId,
            Ikey = draft.Ikey,
            Pattern = settings.Pattern,
            Serial = settings.Serial,
            Status = ElectronicInvoiceStatus.Draft
        };
        invoice.TakeAmounts(draft);
        return invoice;
    }

    /// <summary>A re-issue: the draft at the provider now carries these figures.</summary>
    public void TakeAmounts(ElectronicInvoiceDraft draft)
    {
        Total = draft.Total;
        TaxAmount = draft.TaxAmount;
        Amount = draft.Amount;
        CustomerName = Clip(draft.CustomerName, MaxCustomerNameLength)!;
        PaymentMethod = Clip(draft.PaymentMethod, MaxPaymentMethodLength)!;
        ArisingDate = draft.ArisingDate;
    }

    /// <summary>
    /// Re-issued under another account (the branch changed its config) or
    /// another Mẫu số / ký hiệu: later lookups must go to the account that now
    /// holds the draft.
    /// </summary>
    public void MoveTo(EasyInvoiceSettings settings)
    {
        EnsureReissuable();
        ProviderConfigId = settings.ConfigId;
        Pattern = Clip(settings.Pattern, MaxPatternLength)!;
        Serial = Clip(settings.Serial, MaxSerialLength);
    }

    /// <summary>What the provider says about this invoice now.</summary>
    public void ApplyProviderSummary(ProviderInvoiceSummary summary, DateTimeOffset at)
    {
        if (!string.Equals(summary.Ikey, Ikey, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "The provider answered about a different invoice.");
        }

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
    }

    public void RecordFailure(string? error, DateTimeOffset at)
    {
        LastError = Clip(error, MaxErrorLength);
        LastSyncedAt = at;
    }

    /// <summary>A signed invoice is the tax authority's record; the draft can no longer be rewritten.</summary>
    public void EnsureReissuable()
    {
        if (Status != ElectronicInvoiceStatus.Draft)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.AlreadyPublished);
        }
    }

    /// <summary>
    /// The receipt behind a signed invoice cannot be deleted: the money is on
    /// a tax document. A draft's receipt may go, and the draft row goes with it.
    /// </summary>
    public void EnsureReceiptRemovable()
    {
        if (Status != ElectronicInvoiceStatus.Draft)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ReceiptInvoiced)
                .WithData("No", No ?? Ikey);
        }
    }

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}
