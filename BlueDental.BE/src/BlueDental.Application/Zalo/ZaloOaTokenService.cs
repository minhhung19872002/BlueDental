using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.ClinicIntegration;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Security.Encryption;
using Volo.Abp.Timing;

namespace BlueDental.Zalo;

/// <summary>
/// Keeps a branch's OA tokens usable. Zalo's access token lasts about a day
/// and its refresh token is single-use and lasts about three months, so a
/// refresh is done once, ahead of expiry, under a per-connection lock: two
/// callers refreshing at once would burn the pair.
/// </summary>
public class ZaloOaTokenService : ITransientDependency
{
    public const string RefreshOperation = "oauth-refresh";

    /// <summary>Zalo documents ~3 months for the refresh token; 90 days is the conservative reading.</summary>
    public static readonly TimeSpan RefreshTokenLife = TimeSpan.FromDays(90);

    /// <summary>When Zalo does not say, the access token is assumed to last a day.</summary>
    public static readonly TimeSpan DefaultAccessTokenLife = TimeSpan.FromHours(24);

    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Locks = new();

    private readonly IRepository<ZaloOaConnection, Guid> _connections;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IZaloApiClient _zalo;
    private readonly IStringEncryptionService _encryption;
    private readonly IGuidGenerator _guids;
    private readonly IClock _clock;
    private readonly ILogger<ZaloOaTokenService> _logger;

    public ZaloOaTokenService(
        IRepository<ZaloOaConnection, Guid> connections,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IZaloApiClient zalo,
        IStringEncryptionService encryption,
        IGuidGenerator guids,
        IClock clock,
        ILogger<ZaloOaTokenService> logger)
    {
        _connections = connections;
        _callLogs = callLogs;
        _zalo = zalo;
        _encryption = encryption;
        _guids = guids;
        _clock = clock;
        _logger = logger;
    }

    public ZaloTokenSet Encrypt(string accessToken, string refreshToken, int? expiresInSeconds, DateTime now)
    {
        var accessLife = expiresInSeconds is > 0
            ? TimeSpan.FromSeconds(expiresInSeconds.Value)
            : DefaultAccessTokenLife;

        return new ZaloTokenSet(
            EncryptText(accessToken),
            EncryptText(refreshToken),
            now.Add(accessLife),
            now.Add(RefreshTokenLife));
    }

    public string Decrypt(string cipher) =>
        _encryption.Decrypt(cipher)
        ?? throw new InvalidOperationException("The stored Zalo token could not be decrypted.");

    /// <summary>
    /// The access token to call Zalo with, refreshed first when it is about
    /// to lapse. Throws <c>Tools:0003</c> when the link is not active.
    /// </summary>
    public async Task<string> GetAccessTokenAsync(ZaloOaConnection connection)
    {
        if (connection.IsConnected && connection.IsRefreshDue(_clock.Now))
        {
            await RefreshAsync(connection);
        }

        if (!connection.IsConnected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Tools.ZaloNotConnected,
                "The Zalo OA link is not active.")
                .WithData("message", connection.LastError ?? string.Empty);
        }

        return Decrypt(connection.AccessTokenCipher);
    }

    /// <summary>
    /// Trades the refresh token for a new pair and records the outcome on the
    /// connection. Returns whether Zalo accepted.
    /// </summary>
    public async Task<bool> RefreshAsync(ZaloOaConnection connection)
    {
        var gate = Locks.GetOrAdd(connection.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            // Another caller may have refreshed while this one waited.
            var fresh = await _connections.FindAsync(connection.Id);
            if (fresh != null && fresh.LastRefreshedAt > connection.LastRefreshedAt)
            {
                Copy(fresh, connection);
                return connection.IsConnected;
            }

            var now = _clock.Now;
            if (connection.IsRefreshTokenExpired(now))
            {
                connection.RecordRefreshFailure("The refresh token has expired; connect the OA again.", now);
                await _connections.UpdateAsync(connection, autoSave: true);
                return false;
            }

            var outcome = await _zalo.RefreshTokenAsync(Decrypt(connection.RefreshTokenCipher));
            await _callLogs.InsertAsync(new IntegrationCallLog(
                _guids.Create(), connection.ClinicBranchId, RefreshOperation, outcome.Call.RequestPath,
                outcome.Call.StatusCode, outcome.Call.Succeeded, outcome.Call.DurationMs, 0, outcome.Call.Error));

            if (outcome.Call.Succeeded && outcome.AccessToken != null && outcome.RefreshToken != null)
            {
                connection.ReplaceTokens(
                    Encrypt(outcome.AccessToken, outcome.RefreshToken, outcome.ExpiresInSeconds, now), now);
                _logger.LogInformation("Zalo OA token refreshed for branch {BranchId}", connection.ClinicBranchId);
            }
            else
            {
                connection.RecordRefreshFailure(outcome.Call.Error, now);
                _logger.LogWarning(
                    "Zalo OA token refresh failed for branch {BranchId}: {Error}",
                    connection.ClinicBranchId, outcome.Call.Error);
            }

            await _connections.UpdateAsync(connection, autoSave: true);
            return connection.IsConnected;
        }
        finally
        {
            gate.Release();
        }
    }

    private string EncryptText(string token) =>
        _encryption.Encrypt(token.Trim())
        ?? throw new InvalidOperationException("The Zalo token could not be encrypted.");

    /// <summary>The tracked instance takes the newer row's token state.</summary>
    private static void Copy(ZaloOaConnection source, ZaloOaConnection target)
    {
        if (source.IsConnected)
        {
            target.ReplaceTokens(new ZaloTokenSet(
                source.AccessTokenCipher, source.RefreshTokenCipher,
                source.AccessTokenExpiresAt, source.RefreshTokenExpiresAt), source.LastRefreshedAt ?? DateTime.UtcNow);
        }
        else
        {
            target.RecordRefreshFailure(source.LastError, source.RefreshTokenExpiresAt);
        }
    }
}
