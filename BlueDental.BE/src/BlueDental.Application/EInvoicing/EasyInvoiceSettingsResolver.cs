using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Security.Encryption;

namespace BlueDental.EInvoicing;

/// <summary>
/// Which EasyInvoice account a call goes out under: the one an invoice was
/// filed with, else the branch's active config, else the server-wide
/// <see cref="EasyInvoiceOptions"/>. The password is decrypted here and only
/// lives for the call.
/// </summary>
public class EasyInvoiceSettingsResolver : ITransientDependency
{
    private readonly IRepository<EInvoiceProviderConfig, Guid> _configs;
    private readonly IStringEncryptionService _encryption;
    private readonly IOptions<EasyInvoiceOptions> _options;

    public EasyInvoiceSettingsResolver(
        IRepository<EInvoiceProviderConfig, Guid> configs,
        IStringEncryptionService encryption,
        IOptions<EasyInvoiceOptions> options)
    {
        _configs = configs;
        _encryption = encryption;
        _options = options;
    }

    /// <summary>The account for a new invoice of this branch; null when there is none.</summary>
    public async Task<ResolvedEasyInvoiceAccount?> FindForBranchAsync(Guid clinicBranchId)
    {
        var config = await _configs.FirstOrDefaultAsync(c => c.ClinicBranchId == clinicBranchId && c.IsActive);
        if (config != null)
        {
            return new ResolvedEasyInvoiceAccount(config.ToSettings(Decrypt(config), _options.Value), config.Name);
        }

        var options = _options.Value;
        return options.IsConfigured ? new ResolvedEasyInvoiceAccount(options.ToSettings(), null) : null;
    }

    public async Task<EasyInvoiceSettings> GetForBranchAsync(Guid clinicBranchId) =>
        (await FindForBranchAsync(clinicBranchId))?.Settings ?? throw NotConfigured();

    /// <summary>
    /// The account an existing invoice lives under — lookups must go there even
    /// after the branch switched accounts or turned that config off.
    /// </summary>
    public async Task<EasyInvoiceSettings> GetForInvoiceAsync(ElectronicInvoice invoice)
    {
        if (invoice.ProviderConfigId is not { } configId)
        {
            var options = _options.Value;
            return options.IsConfigured ? options.ToSettings() : throw NotConfigured();
        }

        var config = await _configs.FindAsync(configId) ?? throw NotConfigured();
        return config.ToSettings(Decrypt(config), _options.Value);
    }

    /// <summary>Remembers the numbering a branch account just issued under, for the next dialog.</summary>
    public async Task RememberNumberingAsync(EasyInvoiceSettings settings)
    {
        if (settings.ConfigId is not { } configId)
        {
            return;
        }

        var config = await _configs.FindAsync(configId);
        if (config == null
            || (config.LastPattern == settings.Pattern && config.LastSerial == settings.Serial))
        {
            return;
        }

        config.RememberNumbering(settings.Pattern, settings.Serial);
        await _configs.UpdateAsync(config);
    }

    public string Encrypt(string password) =>
        _encryption.Encrypt(password.Trim())
        ?? throw new InvalidOperationException("The e-invoice password could not be encrypted.");

    private string Decrypt(EInvoiceProviderConfig config) =>
        _encryption.Decrypt(config.PasswordCipher)
        ?? throw new InvalidOperationException("The stored e-invoice password could not be decrypted.");

    private static BusinessException NotConfigured() =>
        new(BlueDentalDomainErrorCodes.EInvoicing.NotConfigured);
}

/// <summary>An account plus the config name the dialog shows (null for the server-wide one).</summary>
public sealed record ResolvedEasyInvoiceAccount(EasyInvoiceSettings Settings, string? ConfigName);
