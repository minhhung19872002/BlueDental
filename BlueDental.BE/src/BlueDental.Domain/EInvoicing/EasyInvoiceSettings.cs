using System;

namespace BlueDental.EInvoicing;

/// <summary>
/// The EasyInvoice account one call goes out under — a branch's own
/// <see cref="EInvoiceProviderConfig"/> or, when the branch has none, the
/// server-wide <see cref="EasyInvoiceOptions"/>. Holds the plaintext password
/// for the length of a request; never logged, never returned to a client.
/// </summary>
public sealed record EasyInvoiceSettings(
    Guid? ConfigId,
    string BaseUrl,
    string Username,
    string Password,
    string TaxCode,
    string Pattern,
    string? Serial,
    int VatRate)
{
    /// <summary>Keeps the password out of anything that prints a record.</summary>
    public override string ToString() =>
        $"EasyInvoiceSettings {{ ConfigId = {ConfigId}, BaseUrl = {BaseUrl}, TaxCode = {TaxCode}, Pattern = {Pattern} }}";
}
