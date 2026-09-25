using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// A branch's link to the partner system — the reference's <c>/v1/connections</c>
/// resource. One per branch. Syncing only ever happens over an
/// <see cref="ClinicConnectionStatus.Active"/> link whose flag is on.
/// </summary>
public class ClinicConnection : FullAuditedAggregateRoot<Guid>
{
    public const int MaxBaseUrlLength = 500;
    public const int MaxErrorLength = 1000;

    public Guid ClinicBranchId { get; private set; }

    /// <summary>Root URL of the partner API; requests are made under it.</summary>
    public string BaseUrl { get; private set; } = string.Empty;

    /// <summary>The API key, encrypted at rest. Never returned to a client.</summary>
    public string ApiKeyCipher { get; private set; } = string.Empty;

    public ClinicConnectionStatus Status { get; private set; }

    public DateTime? LastHandshakeTime { get; private set; }

    /// <summary>Why the last handshake failed; cleared by a successful one.</summary>
    public string? LastError { get; private set; }

    public bool InvoiceSyncEnabled { get; private set; }

    public bool ServiceCatalogSyncEnabled { get; private set; }

    protected ClinicConnection() { }

    public ClinicConnection(Guid id, Guid clinicBranchId, string baseUrl, string apiKeyCipher)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        BaseUrl = NormalizeBaseUrl(baseUrl);
        ApiKeyCipher = Check.NotNullOrWhiteSpace(apiKeyCipher, nameof(apiKeyCipher));
        Status = ClinicConnectionStatus.Pending;
    }

    /// <summary>What the Danh mục screen asks before it offers the sync button.</summary>
    public bool CanSyncServiceCatalog =>
        Status == ClinicConnectionStatus.Active && ServiceCatalogSyncEnabled;

    public bool CanSyncInvoices =>
        Status == ClinicConnectionStatus.Active && InvoiceSyncEnabled;

    /// <summary>
    /// New credentials must be proven again, so the link drops back to
    /// <see cref="ClinicConnectionStatus.Pending"/>. A null key keeps the stored one:
    /// the client is never shown it, so an edit cannot echo it back.
    /// </summary>
    /// <returns>True when the partner URL itself changed.</returns>
    public bool ChangeCredentials(string baseUrl, string? apiKeyCipher)
    {
        var normalized = NormalizeBaseUrl(baseUrl);
        var urlChanged = !string.Equals(normalized, BaseUrl, StringComparison.OrdinalIgnoreCase);

        BaseUrl = normalized;
        if (!string.IsNullOrWhiteSpace(apiKeyCipher))
        {
            ApiKeyCipher = apiKeyCipher;
        }

        Status = ClinicConnectionStatus.Pending;
        LastError = null;
        return urlChanged;
    }

    public void RecordHandshake(bool succeeded, string? error, DateTime at)
    {
        LastHandshakeTime = at;

        if (succeeded)
        {
            Status = ClinicConnectionStatus.Active;
            LastError = null;
            return;
        }

        Status = ClinicConnectionStatus.Failed;
        LastError = Truncate(string.IsNullOrWhiteSpace(error) ? "Handshake failed." : error);
    }

    /// <summary>
    /// A null leaves that flag as it is. Switching a flag on needs a link that
    /// works; switching it off is always allowed.
    /// </summary>
    public void SetSyncFlags(bool? invoiceSyncEnabled, bool? serviceCatalogSyncEnabled)
    {
        var enabling = invoiceSyncEnabled == true || serviceCatalogSyncEnabled == true;
        if (enabling && Status != ClinicConnectionStatus.Active)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.ClinicIntegration.ConnectionNotActive,
                "Sync can only be switched on over an active connection.");
        }

        InvoiceSyncEnabled = invoiceSyncEnabled ?? InvoiceSyncEnabled;
        ServiceCatalogSyncEnabled = serviceCatalogSyncEnabled ?? ServiceCatalogSyncEnabled;
    }

    public void EnsureCanSyncServiceCatalog()
    {
        if (!CanSyncServiceCatalog)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.ClinicIntegration.ServiceCatalogSyncDisabled,
                "Service catalog sync is not enabled for this branch.");
        }
    }

    private static string NormalizeBaseUrl(string baseUrl)
    {
        var trimmed = Check.NotNullOrWhiteSpace(baseUrl, nameof(baseUrl), MaxBaseUrlLength).Trim().TrimEnd('/');

        // The API key travels in a header, so anything off this machine must be
        // HTTPS; plain http is only for a partner sandbox on loopback.
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || !(uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.ClinicIntegration.InvalidPartnerUrl,
                "The partner URL must be an absolute https address without a query (http only on loopback).");
        }

        return trimmed;
    }

    private static string Truncate(string value) =>
        value.Length <= MaxErrorLength ? value : value[..MaxErrorLength];
}
