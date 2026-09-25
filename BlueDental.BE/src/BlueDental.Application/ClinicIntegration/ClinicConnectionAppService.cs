using System;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Security.Encryption;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// Sets up a branch's link to the partner. The reference has these endpoints
/// but, as of 2026-09-25, no screen that calls them — see docs/clone/unknowns.md.
/// </summary>
[Authorize(BlueDentalPermissions.ClinicIntegration.ManageConnections)]
public class ClinicConnectionAppService : ApplicationService, IClinicConnectionAppService
{
    private readonly IRepository<ClinicConnection, Guid> _connections;
    private readonly IRepository<ServiceCatalogSyncState, Guid> _syncStates;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IRepository<ClinicBranch, Guid> _branches;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IStringEncryptionService _encryption;
    private readonly IClinicPartnerClient _partner;

    public ClinicConnectionAppService(
        IRepository<ClinicConnection, Guid> connections,
        IRepository<ServiceCatalogSyncState, Guid> syncStates,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IRepository<ClinicBranch, Guid> branches,
        BranchAccessChecker branchAccess,
        IStringEncryptionService encryption,
        IClinicPartnerClient partner)
    {
        _connections = connections;
        _syncStates = syncStates;
        _callLogs = callLogs;
        _branches = branches;
        _branchAccess = branchAccess;
        _encryption = encryption;
        _partner = partner;
    }

    public async Task<ClinicConnectionDto> GetAsync(Guid clinicBranchId) =>
        ToDto(await GetConnectionAsync(clinicBranchId));

    public async Task<ClinicConnectionDto> CreateAsync(CreateClinicConnectionDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await _branches.GetAsync(input.ClinicBranchId);

        if (await _connections.AnyAsync(c => c.ClinicBranchId == input.ClinicBranchId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.ClinicIntegration.DuplicateConnection,
                "This branch already has a connection; update it instead.");
        }

        var connection = new ClinicConnection(
            GuidGenerator.Create(), input.ClinicBranchId, input.BaseUrl, Encrypt(input.ApiKey));

        await _connections.InsertAsync(connection, autoSave: true);
        return ToDto(connection);
    }

    public async Task<ClinicConnectionDto> UpdateAsync(Guid clinicBranchId, UpdateClinicConnectionDto input)
    {
        var connection = await GetConnectionAsync(clinicBranchId);

        var cipher = string.IsNullOrWhiteSpace(input.ApiKey) ? null : Encrypt(input.ApiKey);
        if (connection.ChangeCredentials(input.BaseUrl, cipher))
        {
            // Another partner knows none of what the old one accepted.
            await _syncStates.DeleteAsync(s => s.ClinicBranchId == clinicBranchId, autoSave: true);
        }

        await _connections.UpdateAsync(connection, autoSave: true);
        return ToDto(connection);
    }

    public async Task<ClinicConnectionDto> HandshakeAsync(Guid clinicBranchId)
    {
        var connection = await GetConnectionAsync(clinicBranchId);
        var endpoint = new PartnerEndpoint(connection.BaseUrl, Decrypt(connection.ApiKeyCipher));

        var outcome = await _partner.HandshakeAsync(endpoint, clinicBranchId);
        await _callLogs.InsertAsync(new IntegrationCallLog(
            GuidGenerator.Create(), clinicBranchId, "handshake", outcome.RequestPath,
            outcome.StatusCode, outcome.Succeeded, outcome.DurationMs, 0, outcome.Error));

        // A refusal is an answer, not an error: the link is recorded as failed
        // and the screen says "Chưa kết nối được", as the reference does.
        connection.RecordHandshake(outcome.Succeeded, outcome.Error, Clock.Now);
        await _connections.UpdateAsync(connection, autoSave: true);
        return ToDto(connection);
    }

    public async Task<ClinicConnectionDto> UpdateSyncFlagsAsync(Guid clinicBranchId, UpdateClinicSyncFlagsDto input)
    {
        var connection = await GetConnectionAsync(clinicBranchId);
        connection.SetSyncFlags(input.InvoiceSyncEnabled, input.ServiceCatalogSyncEnabled);
        await _connections.UpdateAsync(connection, autoSave: true);
        return ToDto(connection);
    }

    private async Task<ClinicConnection> GetConnectionAsync(Guid clinicBranchId)
    {
        await _branchAccess.CheckAsync(clinicBranchId);

        return await _connections.FirstOrDefaultAsync(c => c.ClinicBranchId == clinicBranchId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.ClinicIntegration.ConnectionNotFound,
                "This branch has no connection.");
    }

    private string Encrypt(string apiKey) =>
        _encryption.Encrypt(apiKey.Trim())
        ?? throw new InvalidOperationException("The API key could not be encrypted.");

    private string Decrypt(string cipher) =>
        _encryption.Decrypt(cipher)
        ?? throw new InvalidOperationException("The stored API key could not be decrypted.");

    private static ClinicConnectionDto ToDto(ClinicConnection connection) => new()
    {
        Id = connection.Id,
        ClinicBranchId = connection.ClinicBranchId,
        BaseUrl = connection.BaseUrl,
        HasApiKey = !string.IsNullOrEmpty(connection.ApiKeyCipher),
        Status = ClinicConnectionStatusText.Of(connection.Status),
        LastHandshakeTime = connection.LastHandshakeTime,
        LastError = connection.LastError,
        InvoiceSyncEnabled = connection.InvoiceSyncEnabled,
        ServiceCatalogSyncEnabled = connection.ServiceCatalogSyncEnabled
    };
}

/// <summary>The lower-case status word the reference puts on the wire (<c>"active"</c>).</summary>
internal static class ClinicConnectionStatusText
{
    public const string None = "none";

    public static string Of(ClinicConnectionStatus status) => status switch
    {
        ClinicConnectionStatus.Active => "active",
        ClinicConnectionStatus.Failed => "failed",
        _ => "pending"
    };
}
