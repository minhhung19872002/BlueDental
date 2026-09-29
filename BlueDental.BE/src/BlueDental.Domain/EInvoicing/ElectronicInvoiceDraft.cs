using System.Collections.Generic;
using System.Linq;
using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.EInvoicing;

/// <summary>
/// What BlueDental asks the provider to put on an invoice — the pure shape,
/// before it becomes the provider's XML. Built from a receipt by the
/// application layer; validated here so a malformed draft never leaves.
/// </summary>
public sealed record ElectronicInvoiceDraft
{
    public const string CashPaymentMethod = "Tiền mặt";
    public const string TransferPaymentMethod = "Chuyển khoản";

    /// <summary>Provider-side idempotency key; re-sending a draft's key overwrites it.</summary>
    public required string Ikey { get; init; }

    public required string CustomerCode { get; init; }
    public required string CustomerName { get; init; }
    public string? CustomerAddress { get; init; }
    public string? CustomerPhone { get; init; }
    public string? CustomerTaxCode { get; init; }

    /// <summary>"Tiền mặt" / "Chuyển khoản" — the provider's own labels.</summary>
    public required string PaymentMethod { get; init; }

    /// <summary>Whole-percent VAT on every line; <c>-1</c> means không chịu thuế.</summary>
    public required int VatRate { get; init; }

    public required IReadOnlyList<ElectronicInvoiceLine> Lines { get; init; }

    public decimal Total => Lines.Sum(l => l.Total);
    public decimal TaxAmount => Lines.Sum(l => l.TaxAmount);
    public decimal Amount => Lines.Sum(l => l.Amount);

    public ElectronicInvoiceDraft Validated()
    {
        if (string.IsNullOrWhiteSpace(Ikey) || string.IsNullOrWhiteSpace(CustomerName))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "Ikey and CustomerName are required.");
        }

        if (Lines.Count == 0 || Amount <= 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft)
                .WithData("Reason", "An invoice needs at least one line and a positive total.");
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
