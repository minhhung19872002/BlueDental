using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// A branch's own e-invoice account — the Công cụ › Hóa đơn › Cấu hình row.
///
/// The form carries what the original carries: name, branch, App ID, MST,
/// user, password and the two tax switches. At most one config per branch is
/// active; a branch without an active one falls back to the server-wide
/// <see cref="EasyInvoiceOptions"/>. The provider URL and default VAT come from
/// the server too. Mẫu số / ký hiệu are typed in the Hóa đơn dialog and the
/// last pair that went through is remembered here to prefill the next one.
/// The password is stored encrypted and never leaves the server.
/// </summary>
public class EInvoiceProviderConfig : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 200;
    public const int MaxAppIdLength = 100;
    public const int MaxUsernameLength = 100;
    public const int MaxPasswordCipherLength = 1000;
    public const int MaxTaxCodeLength = 20;

    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Only <see cref="ElectronicInvoice.EasyInvoiceProvider"/> today.</summary>
    public string Provider { get; private set; } = ElectronicInvoice.EasyInvoiceProvider;

    /// <summary>App ID from the original form — EasyInvoice has no such field, so it is kept, not sent.</summary>
    public string? AppId { get; private set; }

    public string Username { get; private set; } = string.Empty;

    /// <summary>The account password, encrypted at rest.</summary>
    public string PasswordCipher { get; private set; } = string.Empty;

    public string TaxCode { get; private set; } = string.Empty;

    /// <summary>"Tính thuế theo dịch vụ" — kept; its effect in the original is UNKNOWN_REFERENCE_BEHAVIOR.</summary>
    public bool TaxByService { get; private set; }

    /// <summary>"Tính thuế theo kỳ" — kept; its effect in the original is UNKNOWN_REFERENCE_BEHAVIOR.</summary>
    public bool TaxByPeriod { get; private set; }

    public bool IsActive { get; private set; }

    /// <summary>Mẫu số of the last invoice issued under this account; prefills the dialog.</summary>
    public string? LastPattern { get; private set; }

    /// <summary>Ký hiệu of the last invoice issued under this account.</summary>
    public string? LastSerial { get; private set; }

    protected EInvoiceProviderConfig() { }

    public EInvoiceProviderConfig(
        Guid id,
        Guid clinicBranchId,
        string name,
        string? appId,
        string username,
        string passwordCipher,
        string taxCode,
        bool taxByService,
        bool taxByPeriod,
        bool isActive)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        PasswordCipher = Check.NotNullOrWhiteSpace(passwordCipher, nameof(passwordCipher), MaxPasswordCipherLength);
        Change(name, appId, username, null, taxCode, taxByService, taxByPeriod, isActive);
    }

    /// <summary>
    /// A null or blank cipher keeps the stored password: the client is never
    /// shown it, so an edit cannot echo it back.
    /// </summary>
    public void Change(
        string name,
        string? appId,
        string username,
        string? passwordCipher,
        string taxCode,
        bool taxByService,
        bool taxByPeriod,
        bool isActive)
    {
        Name = Required(name, nameof(name), MaxNameLength);
        AppId = string.IsNullOrWhiteSpace(appId) ? null : Check.Length(appId.Trim(), nameof(appId), MaxAppIdLength);
        Username = Required(username, nameof(username), MaxUsernameLength);
        TaxCode = Required(taxCode, nameof(taxCode), MaxTaxCodeLength);
        TaxByService = taxByService;
        TaxByPeriod = taxByPeriod;
        IsActive = isActive;

        if (!string.IsNullOrWhiteSpace(passwordCipher))
        {
            PasswordCipher = Check.Length(passwordCipher, nameof(passwordCipher), MaxPasswordCipherLength)!;
        }
    }

    /// <summary>Called once the provider accepted an invoice under this pair.</summary>
    public void RememberNumbering(string pattern, string? serial)
    {
        LastPattern = Check.NotNullOrWhiteSpace(pattern, nameof(pattern), ElectronicInvoice.MaxPatternLength).Trim();
        LastSerial = string.IsNullOrWhiteSpace(serial)
            ? null
            : Check.Length(serial.Trim(), nameof(serial), ElectronicInvoice.MaxSerialLength);
    }

    /// <summary>
    /// The call settings: this account's credentials, the server's URL and
    /// default VAT, and the remembered numbering (else the server's).
    /// </summary>
    public EasyInvoiceSettings ToSettings(string password, EasyInvoiceOptions server) =>
        new(Id, server.BaseUrl.TrimEnd('/'), Username, password, TaxCode,
            LastPattern ?? server.Pattern,
            LastPattern != null ? LastSerial : Blank(server.Serial),
            server.VatRate);

    /// <summary>The form has no rules on these fields, so a blank one is refused here instead.</summary>
    private static string Required(string value, string name, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ConfigIncomplete);
        }

        return Check.Length(value.Trim(), name, maxLength)!;
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
