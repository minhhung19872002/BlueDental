using System;
using System.Security.Cryptography;
using BlueDental.Billing;
using BlueDental.Security;
using Microsoft.Extensions.Options;
using Shouldly;
using Volo.Abp.Security.Encryption;
using Xunit;

namespace BlueDental.Domain.Tests.Security;

/// <summary>
/// The integration-credential cipher: new values use the vault key, old ABP
/// values still open, and a server without a vault key behaves as before.
/// </summary>
public class SecretCipherTests
{
    private const string Purpose = SecretPurposes.EInvoicePassword;

    [Fact]
    public void Protect_with_vault_key_round_trips_and_hides_the_plain_value()
    {
        var cipher = Cipher(RandomNumberGenerator.GetBytes(32));

        var stored = cipher.Protect("Mật-khẩu@123", Purpose);

        stored.ShouldStartWith("v1:");
        stored.ShouldNotContain("123");
        cipher.IsCurrent(stored).ShouldBeTrue();
        cipher.Unprotect(stored, Purpose).ShouldBe("Mật-khẩu@123");
    }

    [Fact]
    public void Same_value_encrypts_differently_each_time()
    {
        var cipher = Cipher(RandomNumberGenerator.GetBytes(32));

        cipher.Protect("secret", Purpose).ShouldNotBe(cipher.Protect("secret", Purpose));
    }

    [Fact]
    public void A_value_does_not_open_under_another_purpose()
    {
        var cipher = Cipher(RandomNumberGenerator.GetBytes(32));
        var stored = cipher.Protect("secret", SecretPurposes.EInvoicePassword);

        Should.Throw<CryptographicException>(() => cipher.Unprotect(stored, SecretPurposes.ClinicApiKey));
    }

    [Fact]
    public void A_value_does_not_open_under_another_vault_key()
    {
        var stored = Cipher(RandomNumberGenerator.GetBytes(32)).Protect("secret", Purpose);

        Should.Throw<CryptographicException>(() =>
            Cipher(RandomNumberGenerator.GetBytes(32)).Unprotect(stored, Purpose));
    }

    [Fact]
    public void An_old_abp_value_still_opens_and_is_not_current()
    {
        var old = Legacy().Encrypt("secret")!;
        var cipher = Cipher(RandomNumberGenerator.GetBytes(32));

        cipher.IsCurrent(old).ShouldBeFalse();
        cipher.Unprotect(old, Purpose).ShouldBe("secret");
    }

    [Fact]
    public void Without_vault_key_values_keep_the_old_format()
    {
        var cipher = Cipher(null);

        cipher.CanProtect.ShouldBeFalse();
        var stored = cipher.Protect("secret", Purpose);
        cipher.IsCurrent(stored).ShouldBeFalse();
        Legacy().Decrypt(stored).ShouldBe("secret");
    }

    [Fact]
    public void A_new_value_without_vault_key_is_refused_clearly()
    {
        var stored = Cipher(RandomNumberGenerator.GetBytes(32)).Protect("secret", Purpose);

        Should.Throw<Volo.Abp.BusinessException>(() => Cipher(null).Unprotect(stored, Purpose))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.ReceiptVaultKeyMissing);
    }

    private static StringEncryptionService Legacy() =>
        new(Options.Create(new AbpStringEncryptionOptions { DefaultPassPhrase = "BlueDentalDefaultPassPhrase" }));

    private static AesGcmSecretCipher Cipher(byte[]? vaultKey) =>
        new(Options.Create(new ReceiptVaultOptions { Key = vaultKey is null ? null : Convert.ToBase64String(vaultKey) }),
            Legacy());
}
