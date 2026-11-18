namespace BlueDental.EInvoicing;

/// <summary>
/// The buyer a "Yêu cầu xuất HĐ" sends to EasyInvoice (P1811): a person under
/// their CCCD as Mã số thuế, a company under its own.
/// </summary>
internal sealed record InvoiceBuyer(
    string BuyerName,
    string? CompanyName,
    string? TaxCode,
    string? Address,
    string? Phone,
    string? Email,
    string? NationalId);
