using System;
using System.Security.Cryptography;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.ClinicIntegration;
using BlueDental.EInvoicing;
using BlueDental.Security;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Security.Encryption;
using Volo.Abp.Uow;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Security;

/// <summary>
/// Integration credentials saved before the vault-key cipher (ABP passphrase,
/// committed in appsettings.json) are rewritten in place on real PostgreSQL:
/// same plain value, new format, nothing else on the row touched.
/// </summary>
public class SecretCipherUpgradeTests : BlueDentalPostgresTestBase
{
    private const string Password = "Mật-khẩu@EasyInvoice1";
    private const string ApiKey = "partner-key-123";

    // The container is shared by the whole run, and the upgrader reads every row.
    public SecretCipherUpgradeTests() => PostgresTestDatabase.Execute(
        "DELETE FROM bd_einvoice_provider_configs; DELETE FROM bd_clinic_connections;");

    // Repositories take their services by property injection, which only Autofac does.
    protected override void SetAbpApplicationCreationOptions(AbpApplicationCreationOptions options) =>
        options.UseAutofac();

    protected override void AfterAddApplication(IServiceCollection services) =>
        services.Configure<ReceiptVaultOptions>(o => o.Key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));

    [Fact]
    public async Task Old_Values_Are_Rewritten_With_The_Vault_Key_And_Still_Open()
    {
        var legacy = GetRequiredService<IStringEncryptionService>();
        var configId = await InsertAsync<EInvoiceProviderConfig>(new EInvoiceProviderConfig(
            Guid.NewGuid(), Guid.NewGuid(), "EasyInvoice", null, "user", legacy.Encrypt(Password)!,
            "0100000000", taxByService: false, taxByPeriod: false, isActive: true));
        var connectionId = await InsertAsync(ActiveConnection(legacy.Encrypt(ApiKey)!));

        (await Upgrader().UpgradeAsync()).ShouldBe(2);

        var cipher = GetRequiredService<ISecretCipher>();
        var config = await LoadAsync<EInvoiceProviderConfig>(configId);
        config.PasswordCipher.ShouldStartWith("v1:");
        cipher.Unprotect(config.PasswordCipher, SecretPurposes.EInvoicePassword).ShouldBe(Password);
        config.IsActive.ShouldBeTrue();

        var connection = await LoadAsync<ClinicConnection>(connectionId);
        connection.ApiKeyCipher.ShouldStartWith("v1:");
        cipher.Unprotect(connection.ApiKeyCipher, SecretPurposes.ClinicApiKey).ShouldBe(ApiKey);
        connection.Status.ShouldBe(ClinicConnectionStatus.Active);
    }

    [Fact]
    public async Task A_Second_Run_Leaves_Current_Values_Alone()
    {
        var legacy = GetRequiredService<IStringEncryptionService>();
        var connectionId = await InsertAsync(ActiveConnection(legacy.Encrypt(ApiKey)!));
        (await Upgrader().UpgradeAsync()).ShouldBe(1);
        var first = (await LoadAsync<ClinicConnection>(connectionId)).ApiKeyCipher;

        (await Upgrader().UpgradeAsync()).ShouldBe(0);

        (await LoadAsync<ClinicConnection>(connectionId)).ApiKeyCipher.ShouldBe(first);
    }

    [Fact]
    public async Task A_Soft_Deleted_Account_Is_Upgraded_Too()
    {
        // Invoices issued under a removed account still look its password up.
        var legacy = GetRequiredService<IStringEncryptionService>();
        var configId = await InsertAsync<EInvoiceProviderConfig>(new EInvoiceProviderConfig(
            Guid.NewGuid(), Guid.NewGuid(), "Old account", null, "user", legacy.Encrypt(Password)!,
            "0100000000", taxByService: false, taxByPeriod: false, isActive: false));
        await WithUnitOfWorkAsync(() =>
            GetRequiredService<IRepository<EInvoiceProviderConfig, Guid>>().DeleteAsync(configId, autoSave: true));

        (await Upgrader().UpgradeAsync()).ShouldBe(1);

        var config = await LoadAsync<EInvoiceProviderConfig>(configId);
        config.IsDeleted.ShouldBeTrue();
        GetRequiredService<ISecretCipher>()
            .Unprotect(config.PasswordCipher, SecretPurposes.EInvoicePassword).ShouldBe(Password);
        config.PasswordCipher.ShouldStartWith("v1:");
    }

    private SecretCipherUpgrader Upgrader() => GetRequiredService<SecretCipherUpgrader>();

    private static ClinicConnection ActiveConnection(string apiKeyCipher)
    {
        var connection = new ClinicConnection(Guid.NewGuid(), Guid.NewGuid(), "https://partner.test", apiKeyCipher);
        connection.RecordHandshake(succeeded: true, error: null, at: DateTime.UtcNow);
        return connection;
    }

    private async Task<Guid> InsertAsync<TEntity>(TEntity entity) where TEntity : class, Volo.Abp.Domain.Entities.IEntity<Guid>
    {
        await WithUnitOfWorkAsync(() =>
            GetRequiredService<IRepository<TEntity, Guid>>().InsertAsync(entity, autoSave: true));
        return entity.Id;
    }

    private Task<TEntity> LoadAsync<TEntity>(Guid id) where TEntity : class, Volo.Abp.Domain.Entities.IEntity<Guid> =>
        WithUnitOfWorkAsync(async () =>
        {
            using (GetRequiredService<IDataFilter<ISoftDelete>>().Disable())
            {
                return await GetRequiredService<IRepository<TEntity, Guid>>().GetAsync(id);
            }
        });

    private async Task<T> WithUnitOfWorkAsync<T>(Func<Task<T>> action)
    {
        using var uow = GetRequiredService<IUnitOfWorkManager>().Begin(requiresNew: true);
        var result = await action();
        await uow.CompleteAsync();
        return result;
    }

    private Task WithUnitOfWorkAsync(Func<Task> action) =>
        WithUnitOfWorkAsync(async () => { await action(); return true; });
}
