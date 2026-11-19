using System;
using System.Security.Cryptography;
using System.Text;
using BlueDental.Billing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Security.Encryption;

namespace BlueDental.Security;

/// <summary>What a stored secret is for; bound into its ciphertext so one cannot stand in for another.</summary>
public static class SecretPurposes
{
    public const string EInvoicePassword = "einvoice-password";
    public const string ClinicApiKey = "clinic-api-key";
    public const string ZaloToken = "zalo-token";
}

/// <summary>
/// Encrypts the integration credentials the server must read back — the
/// EasyInvoice password, the partner API key, the Zalo OA tokens — so they can
/// be sent on. They cannot be hashed for that reason.
/// </summary>
public interface ISecretCipher
{
    string Protect(string plain, string purpose);

    string Unprotect(string cipher, string purpose);

    /// <summary>False for a value still in the old format, which SecretCipherUpgradeWorker rewrites.</summary>
    bool IsCurrent(string cipher);

    /// <summary>True when the server has a vault key, so <see cref="Protect"/> writes the current format.</summary>
    bool CanProtect { get; }
}

/// <summary>
/// AES-256-GCM (NIST SP 800-38D), random 96-bit nonce, 128-bit tag, the purpose
/// as associated data; stored as <c>v1:</c> + base64(nonce ‖ tag ‖ ciphertext).
/// The key comes from the receipt vault key by HKDF-SHA256 (info
/// <c>bluedental/secrets/v1</c>), like <see cref="Chat.AesGcmChatCipher"/>, so it is
/// kept out of git and never equals the chat or receipt key.
///
/// A value without the prefix was written by ABP's
/// <see cref="IStringEncryptionService"/>, whose passphrase sits in
/// appsettings.json; it is still read, and is rewritten in the new format.
/// Without a vault key (a bare dev box, tests) new values keep the old format,
/// exactly as before.
/// </summary>
public class AesGcmSecretCipher(
    IOptions<ReceiptVaultOptions> options,
    IStringEncryptionService legacy,
    ILogger<AesGcmSecretCipher>? logger = null) : ISecretCipher, ITransientDependency
{
    private const string Prefix = "v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private static readonly byte[] KeyInfo = Encoding.UTF8.GetBytes("bluedental/secrets/v1");

    private readonly ILogger _logger = logger ?? NullLogger<AesGcmSecretCipher>.Instance;

    public bool CanProtect => VaultKey() is not null;

    public bool IsCurrent(string cipher) => cipher.StartsWith(Prefix, StringComparison.Ordinal);

    public string Protect(string plain, string purpose)
    {
        var key = DerivedKey();
        if (key is null)
        {
            _logger.LogWarning("ReceiptVault:Key is not set: a secret is stored in the old format.");
            return legacy.Encrypt(plain)
                ?? throw new InvalidOperationException("The secret could not be encrypted.");
        }

        var bytes = Encoding.UTF8.GetBytes(plain);
        var sealedBytes = new byte[NonceSize + TagSize + bytes.Length];
        var nonce = sealedBytes.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);
        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(
            nonce,
            bytes,
            sealedBytes.AsSpan(NonceSize + TagSize),
            sealedBytes.AsSpan(NonceSize, TagSize),
            Encoding.UTF8.GetBytes(purpose));
        return Prefix + Convert.ToBase64String(sealedBytes);
    }

    public string Unprotect(string cipher, string purpose)
    {
        if (!IsCurrent(cipher))
        {
            return legacy.Decrypt(cipher)
                ?? throw new InvalidOperationException("The stored secret could not be decrypted.");
        }

        var key = DerivedKey()
            ?? throw new Volo.Abp.BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptVaultKeyMissing);
        var sealedBytes = Convert.FromBase64String(cipher[Prefix.Length..]);
        if (sealedBytes.Length < NonceSize + TagSize)
        {
            throw new CryptographicException("The stored secret is too short.");
        }

        var plain = new byte[sealedBytes.Length - NonceSize - TagSize];
        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(
            sealedBytes.AsSpan(0, NonceSize),
            sealedBytes.AsSpan(NonceSize + TagSize),
            sealedBytes.AsSpan(NonceSize, TagSize),
            plain,
            Encoding.UTF8.GetBytes(purpose));
        return Encoding.UTF8.GetString(plain);
    }

    private byte[]? DerivedKey()
    {
        var vaultKey = VaultKey();
        return vaultKey is null ? null : HKDF.DeriveKey(HashAlgorithmName.SHA256, vaultKey, 32, info: KeyInfo);
    }

    private byte[]? VaultKey()
    {
        var configured = options.Value.Key;
        if (string.IsNullOrWhiteSpace(configured))
        {
            return null;
        }

        try
        {
            var bytes = Convert.FromBase64String(configured.Trim());
            return bytes.Length == 32 ? bytes : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
