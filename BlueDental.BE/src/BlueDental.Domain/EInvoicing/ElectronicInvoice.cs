using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// One hóa đơn điện tử BlueDental created at the provider for one receipt.
///
/// The row is BlueDental's memory of the provider's invoice: its key, the
/// pattern it was filed under and the last status heard. Money is copied from
/// the receipt at issue time so the list reads without a provider round trip.
/// One receipt gives at most one invoice; re-issuing a draft overwrites it at
/// the provider under the same key.
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

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }

    /// <summary>The receipt this invoice bills.</summary>
    public Guid PatientPaymentId { get; private set; }

    public Guid? TreatmentPlanId { get; private set; }

    public string Provider { get; private set; } = EasyInvoiceProvider;

    /// <summary>The provider's idempotency key — <c>bd-{receipt id}</c>.</summary>
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

    public DateTimeOffset? LastSyncedAt { get; private set; }

    /// <summary>The provider's last refusal, cleared by the next success.</summary>
    public string? LastError { get; private set; }

    protected ElectronicInvoice() { }

    public static ElectronicInvoice Create(
        Guid id,
        Guid clinicBranchId,
        Guid patientId,
        Guid patientPaymentId,
        Guid? treatmentPlanId,
        string ikey,
        string pattern,
        ElectronicInvoiceDraft draft)
    {
        Check.NotNullOrWhiteSpace(ikey, nameof(ikey), MaxIkeyLength);
        Check.NotNullOrWhiteSpace(pattern, nameof(pattern), MaxPatternLength);

        var invoice = new ElectronicInvoice
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientId = patientId,
            PatientPaymentId = patientPaymentId,
            TreatmentPlanId = treatmentPlanId,
            Ikey = ikey,
            Pattern = pattern,
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

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}
