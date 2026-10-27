using System;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Billing;

/// <summary>
/// Encrypts what the receipt flow keeps of the customer — the iPad signature
/// as text in the database, the exported PDF as bytes in blob storage —
/// before it is stored.
/// </summary>
public interface IReceiptCipher
{
    string Encrypt(byte[] plain);
    byte[] Decrypt(string cipher);

    byte[] Seal(byte[] plain);
    byte[] Open(byte[] sealedFile);
}

public class ReceiptVaultOptions
{
    public const string SectionName = "ReceiptVault";

    /// <summary>
    /// Base64 of 32 random bytes. Kept out of git: appsettings.Development.json
    /// locally, the <c>ReceiptVault__Key</c> environment variable on a server.
    /// Losing it loses every stored signature and receipt file.
    /// </summary>
    public string? Key { get; set; }
}

/// <summary>
/// AES-256-GCM over nonce ‖ tag ‖ ciphertext. Text is stored as <c>v1:</c> +
/// base64 of that, a file as version byte 0x01 + that, so a later key or
/// algorithm can sit next to either.
/// </summary>
public class AesGcmReceiptCipher(IOptions<ReceiptVaultOptions> options) : IReceiptCipher, ITransientDependency
{
    private const string Prefix = "v1:";
    private const byte FileVersion = 0x01;
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public string Encrypt(byte[] plain) => Prefix + Convert.ToBase64String(SealCore(plain));

    public byte[] Decrypt(string cipher)
    {
        if (!cipher.StartsWith(Prefix, StringComparison.Ordinal))
        {
            throw new CryptographicException("Unknown receipt cipher format.");
        }

        return OpenCore(Convert.FromBase64String(cipher[Prefix.Length..]));
    }

    public byte[] Seal(byte[] plain)
    {
        var core = SealCore(plain);
        var file = new byte[1 + core.Length];
        file[0] = FileVersion;
        core.CopyTo(file, 1);
        return file;
    }

    public byte[] Open(byte[] sealedFile)
    {
        if (sealedFile.Length < 1 + NonceSize + TagSize || sealedFile[0] != FileVersion)
        {
            throw new CryptographicException("Unknown receipt file format.");
        }

        return OpenCore(sealedFile.AsSpan(1).ToArray());
    }

    private byte[] SealCore(byte[] plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var sealedBytes = new byte[NonceSize + TagSize + plain.Length];
        using (var aes = new AesGcm(Key(), TagSize))
        {
            aes.Encrypt(
                nonce,
                plain,
                sealedBytes.AsSpan(NonceSize + TagSize),
                sealedBytes.AsSpan(NonceSize, TagSize));
        }

        nonce.CopyTo(sealedBytes, 0);
        return sealedBytes;
    }

    private byte[] OpenCore(byte[] sealedBytes)
    {
        var plain = new byte[sealedBytes.Length - NonceSize - TagSize];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Decrypt(
            sealedBytes.AsSpan(0, NonceSize),
            sealedBytes.AsSpan(NonceSize + TagSize),
            sealedBytes.AsSpan(NonceSize, TagSize),
            plain);
        return plain;
    }

    private byte[] Key()
    {
        var configured = options.Value.Key;
        byte[]? key = null;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            try
            {
                key = Convert.FromBase64String(configured.Trim());
            }
            catch (FormatException)
            {
                key = null;
            }
        }

        if (key is not { Length: 32 })
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptVaultKeyMissing);
        }

        return key;
    }
}
