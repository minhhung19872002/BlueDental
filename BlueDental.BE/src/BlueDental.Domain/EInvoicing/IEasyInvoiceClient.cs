using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BlueDental.EInvoicing;

/// <summary>
/// The provider's three calls BlueDental needs. A call never throws: failure
/// comes back as an outcome so the caller can log it and tell the cashier.
/// </summary>
public interface IEasyInvoiceClient
{
    /// <summary>Creates (or, for a draft with the same key, replaces) an invoice draft.</summary>
    Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportInvoiceAsync(
        string xmlData, CancellationToken cancellationToken = default);

    Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> GetByIkeysAsync(
        IReadOnlyList<string> ikeys, CancellationToken cancellationToken = default);

    /// <summary>The invoice as the provider renders it.</summary>
    Task<EasyInvoiceCallResult<byte[]>> GetPdfAsync(string ikey, CancellationToken cancellationToken = default);
}

/// <summary>
/// Shape of one call, whatever happened: the HTTP status when a response came
/// back, the provider's <c>ErrorCode</c> when it refused, and the data on success.
/// Never carries the request body or headers — those hold the password.
/// </summary>
public sealed record EasyInvoiceCallResult<T>(
    string RequestPath,
    int? StatusCode,
    bool Succeeded,
    long DurationMs,
    string? Error,
    int? ErrorCode,
    T? Data)
{
    /// <summary>What the call log stores: the provider's code in front of its message.</summary>
    public string? LogError => Error == null ? null : ErrorCode == null ? Error : $"{ErrorCode}: {Error}";
}

/// <summary>The provider's <c>InvoiceSummary</c>, the parts BlueDental keeps.</summary>
public sealed record ProviderInvoiceSummary(
    string Ikey,
    int InvoiceStatus,
    string? Pattern,
    string? Serial,
    string? No,
    string? LookupCode,
    string? LinkView,
    decimal Total,
    decimal TaxAmount,
    decimal Amount,
    string? CustomerName)
{
    /// <summary>
    /// The provider numbers an invoice only when it is signed; a draft shows
    /// <c>No = "0"</c>. Cancellation states are not observable on the sandbox
    /// (UNKNOWN_REFERENCE_BEHAVIOR), so anything numbered reads as published.
    /// </summary>
    public ElectronicInvoiceStatus Status =>
        InvoiceStatus == 0 || string.IsNullOrEmpty(No) || No == "0"
            ? ElectronicInvoiceStatus.Draft
            : ElectronicInvoiceStatus.Published;
}
