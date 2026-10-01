using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.EInvoicing;

/// <summary>
/// What BlueDental asks the provider to put on an invoice — the pure shape,
/// before it becomes the provider's XML. Built by the application layer from
/// a receipt or a treatment slip (and whatever the cashier edited in the
/// Hóa đơn dialog); validated here so a malformed draft never leaves.
/// </summary>
public sealed record ElectronicInvoiceDraft
{
    public const string CashPaymentMethod = "Tiền mặt";
    public const string TransferPaymentMethod = "Chuyển khoản";
    public const string CashOrTransferPaymentMethod = "TM/CK";

    /// <summary>The VAT rates the provider accepts; <c>-1</c> is không chịu thuế (KCT).</summary>
    public static readonly IReadOnlyList<int> AllowedVatRates = [-1, 0, 5, 8, 10];

    /// <summary>The provider's limit on a product name (integration document).</summary>
    public const int MaxLineNameLength = 300;

    /// <summary>Provider-side idempotency key; re-sending a draft's key overwrites it.</summary>
    public required string Ikey { get; init; }

    public required string CustomerCode { get; init; }

    /// <summary>
    /// <c>CusName</c> — the party the invoice is made out to: the company when
    /// the buyer gave one, the person otherwise.
    /// </summary>
    public required string CustomerName { get; init; }

    /// <summary><c>Buyer</c> — the person who bought; falls back to <see cref="CustomerName"/>.</summary>
    public string? BuyerName { get; init; }

    public string? CustomerAddress { get; init; }
    public string? CustomerPhone { get; init; }
    public string? CustomerTaxCode { get; init; }

    /// <summary>"Tiền mặt" / "Chuyển khoản" / "TM/CK" — the provider's own labels.</summary>
    public required string PaymentMethod { get; init; }

    /// <summary>Ngày hóa đơn; null lets the provider stamp the day it receives it.</summary>
    public DateTime? ArisingDate { get; init; }

    /// <summary>Whole-percent VAT shared by every line; <c>-1</c> means không chịu thuế.</summary>
    public required int VatRate { get; init; }

    public required IReadOnlyList<ElectronicInvoiceLine> Lines { get; init; }

    public decimal Total => Lines.Sum(l => l.Total);
    public decimal TaxAmount => Lines.Sum(l => l.TaxAmount);
    public decimal Amount => Lines.Sum(l => l.Amount);

    public ElectronicInvoiceDraft Validated()
    {
        if (string.IsNullOrWhiteSpace(Ikey) || string.IsNullOrWhiteSpace(CustomerName))
        {
            throw Invalid("Ikey and CustomerName are required.");
        }

        if (Lines.Count == 0 || Amount <= 0m)
        {
            throw Invalid("An invoice needs at least one line and a positive total.");
        }

        if (Lines.Any(l => string.IsNullOrWhiteSpace(l.Name) || l.Quantity <= 0m || l.UnitPrice < 0m))
        {
            throw Invalid("Every line needs a name, a positive quantity and a price.");
        }

        if (Lines.Any(l => l.Name.Trim().Length > MaxLineNameLength))
        {
            throw Invalid($"A line name is longer than {MaxLineNameLength} characters.");
        }

        // The invoice carries one VATRate in its header; a mixed-rate invoice
        // has never been tried against the provider (docs/clone/unknowns.md).
        if (!AllowedVatRates.Contains(VatRate) || Lines.Any(l => l.VatRate != VatRate))
        {
            throw Invalid("Every line must share one VAT rate among -1, 0, 5, 8, 10.");
        }

        return this;
    }

    public static ElectronicInvoiceLine Line(
        string code, string name, string unit, decimal quantity, decimal unitPrice, int vatRate)
    {
        var total = Vnd.Round(quantity * unitPrice);
        var tax = vatRate > 0 ? Vnd.Round(total * vatRate / 100m) : 0m;
        return new ElectronicInvoiceLine(code, name, unit, quantity, unitPrice, total, vatRate, tax, total + tax);
    }

    private static BusinessException Invalid(string reason) =>
        new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft).WithData("Reason", reason);
}

/// <summary>One product row; money is whole đồng, tax already applied.</summary>
public sealed record ElectronicInvoiceLine(
    string Code,
    string Name,
    string Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal Total,
    int VatRate,
    decimal TaxAmount,
    decimal Amount);
