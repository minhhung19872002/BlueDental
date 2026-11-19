using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.ClinicIntegration;
using BlueDental.EInvoicing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;

namespace BlueDental.Security;

/// <summary>
/// Rewrites the e-invoice passwords and partner API keys still encrypted with
/// ABP's passphrase (committed in appsettings.json) into the vault-key format
/// of <see cref="AesGcmSecretCipher"/>. The plain value never changes, so
/// nothing a user sees or a provider receives changes. Soft-deleted rows are
/// included: invoices filed under a removed account still look it up.
///
/// Zalo OA tokens are left to <c>ZaloTokenRefreshWorker</c>: each refresh
/// stores them in the new format anyway, and rewriting a row a refresh is
/// working on could keep a refresh token Zalo has already spent.
///
/// Does nothing while the server has no vault key. Each row is its own unit
/// of work: an edit racing this one changes the concurrency stamp, this save
/// fails, the old value stays and keeps working, and the next run tries again.
/// </summary>
public class SecretCipherUpgrader(
    ISecretCipher cipher,
    IUnitOfWorkManager unitOfWorkManager,
    IDataFilter<ISoftDelete> softDelete,
    IRepository<EInvoiceProviderConfig, Guid> configs,
    IRepository<ClinicConnection, Guid> connections,
    ILogger<SecretCipherUpgrader>? logger = null) : ITransientDependency
{
    private readonly ILogger _logger = logger ?? NullLogger<SecretCipherUpgrader>.Instance;

    /// <returns>How many values were rewritten.</returns>
    public async Task<int> UpgradeAsync()
    {
        if (!cipher.CanProtect)
        {
            return 0;
        }

        using (softDelete.Disable())
        {
            var passwords = await UpgradeAsync(configs, c => c.PasswordCipher,
                c => c.ReencryptPassword(Reencrypt(c.PasswordCipher, SecretPurposes.EInvoicePassword)));
            var apiKeys = await UpgradeAsync(connections, c => c.ApiKeyCipher,
                c => c.ReencryptApiKey(Reencrypt(c.ApiKeyCipher, SecretPurposes.ClinicApiKey)));

            if (passwords + apiKeys > 0)
            {
                _logger.LogInformation(
                    "Secrets: re-encrypted {Passwords} e-invoice password(s) and {ApiKeys} partner API key(s) with the vault key.",
                    passwords, apiKeys);
            }

            return passwords + apiKeys;
        }
    }

    private string Reencrypt(string stored, string purpose) =>
        cipher.Protect(cipher.Unprotect(stored, purpose), purpose);

    private async Task<int> UpgradeAsync<TEntity>(
        IRepository<TEntity, Guid> repository,
        Func<TEntity, string> cipherOf,
        Action<TEntity> reencrypt)
        where TEntity : class, IEntity<Guid>
    {
        List<Guid> ids;
        using (var uow = unitOfWorkManager.Begin(requiresNew: true))
        {
            // A handful of rows per branch: read them all, filter in memory.
            ids = (await repository.GetListAsync())
                .Where(r => !cipher.IsCurrent(cipherOf(r)))
                .Select(r => r.Id)
                .ToList();
            await uow.CompleteAsync();
        }

        var upgraded = 0;
        foreach (var id in ids)
        {
            try
            {
                using var uow = unitOfWorkManager.Begin(requiresNew: true);
                var row = await repository.FindAsync(id);
                if (row is null || cipher.IsCurrent(cipherOf(row)))
                {
                    continue;
                }

                reencrypt(row);
                await repository.UpdateAsync(row, autoSave: true);
                await uow.CompleteAsync();
                upgraded++;
            }
            catch (Exception ex) when (ex is not OutOfMemoryException)
            {
                _logger.LogWarning("Secrets: {Entity} {Id} kept its old encryption ({Error}).",
                    typeof(TEntity).Name, id, ex.GetType().Name);
            }
        }

        return upgraded;
    }
}
