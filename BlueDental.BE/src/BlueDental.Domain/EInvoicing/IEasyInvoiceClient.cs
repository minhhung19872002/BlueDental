using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BlueDental.EInvoicing;

/// <summary>
/// The provider's calls BlueDental needs, each made under the account it is
/// given. A call never throws: failure comes back as an outcome so the caller
/// can log it and tell the cashier.
/// </summary>
public interface IEasyInvoiceClient
{
    /// <summary>Creates (or, for a draft with the same key, replaces) an invoice draft.</summary>
    Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportInvoiceAsync(
        EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates and signs the invoice in one call. Needs the account's signing
    /// device (HSM); the sandbox has none and answers 196.
    /// </summary>
    Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportAndPublishAsync(
        EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken = default);

    Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> GetByIkeysAsync(
        EasyInvoiceSettings settings, IReadOnlyList<string> ikeys, CancellationToken cancellationToken = default);

    /// <summary>The invoice as the provider renders it.</summary>
    Task<EasyInvoiceCallResult<byte[]>> GetPdfAsync(
        EasyInvoiceSettings settings, string ikey, CancellationToken cancellationToken = default);
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
    /// EasyInvoice's <c>InvoiceStatus</c>, per its integration (DLL) document:
    /// 0 unsigned, 1 signed, 2 declared to tax, 3 replaced, 4 adjusted,
    /// 5 cancelled, 6 approved. Only 0 and 1 have been seen on the sandbox; the
    /// rest are UNKNOWN_REFERENCE_BEHAVIOR on REST. The provider numbers an
    /// invoice only when it is signed, so an unnumbered one is still a draft.
    /// </summary>
    public ElectronicInvoiceStatus Status => InvoiceStatus switch
    {
        5 => ElectronicInvoiceStatus.Cancelled,
        _ when InvoiceStatus == 0 || string.IsNullOrEmpty(No) || No == "0" => ElectronicInvoiceStatus.Draft,
        3 => ElectronicInvoiceStatus.Replaced,
        4 => ElectronicInvoiceStatus.Adjusted,
        _ => ElectronicInvoiceStatus.Published
    };
}
