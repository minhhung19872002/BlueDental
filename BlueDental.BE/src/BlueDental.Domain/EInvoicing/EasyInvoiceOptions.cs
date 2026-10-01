namespace BlueDental.EInvoicing;

/// <summary>
/// The <c>EasyInvoice</c> configuration section — the SoftDreams e-invoice
/// account BlueDental issues hóa đơn điện tử through. Base URL, user, tax code
/// and pattern may sit in appsettings; the password never does (environment
/// <c>EasyInvoice__Password</c> or user-secrets only).
/// </summary>
public class EasyInvoiceOptions
{
    public const string SectionName = "EasyInvoice";

    /// <summary>Sandbox is plain HTTP; production must be HTTPS.</summary>
    public string BaseUrl { get; set; } = "http://api.softdreams.vn";

    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>The clinic's MST — the tenant the account belongs to.</summary>
    public string TaxCode { get; set; } = string.Empty;

    /// <summary>
    /// Mẫu số hóa đơn, e.g. <c>1C26TYY</c> — only the first suggestion: the
    /// cashier types it in the Hóa đơn dialog and a branch account remembers it.
    /// </summary>
    public string Pattern { get; set; } = string.Empty;

    /// <summary>Ký hiệu; empty lets the provider pick the pattern's serial.</summary>
    public string Serial { get; set; } = string.Empty;

    /// <summary>
    /// VAT rate on every line. Dental care is a medical service — VAT-exempt —
    /// so the default is the provider's <c>-1</c> (KCT). A clinic that bills
    /// taxable services sets 8 or 10.
    /// </summary>
    public int VatRate { get; set; } = -1;

    public int TimeoutSeconds { get; set; } = 30;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(BaseUrl)
        && !string.IsNullOrWhiteSpace(Username)
        && !string.IsNullOrWhiteSpace(Password)
        && !string.IsNullOrWhiteSpace(TaxCode);

    /// <summary>The server-wide account, used by a branch that has no config of its own.</summary>
    public EasyInvoiceSettings ToSettings() =>
        new(null, BaseUrl.TrimEnd('/'), Username, Password, TaxCode, Pattern,
            string.IsNullOrWhiteSpace(Serial) ? null : Serial, VatRate);
}
