using System;
using System.Security.Cryptography;
using System.Text;
using BlueDental.Billing;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Chat;

/// <summary>
/// Encrypts what Chat nội bộ keeps (F-89, owner 2026-11-06: "data tin nhắn phải
/// được mã hóa đúng chuẩn"): the message text and the file names in the
/// database, the files themselves in blob storage. Nothing readable is stored.
///
/// Every ciphertext is bound to the id of the row it belongs to, so a value
/// copied onto another message or file fails to open instead of showing there.
/// </summary>
public interface IChatCipher
{
    string EncryptText(string plain, Guid boundTo);

    string DecryptText(string cipher, Guid boundTo);

    byte[] SealFile(ReadOnlySpan<byte> plain, Guid boundTo);

    byte[] OpenFile(byte[] sealedFile, Guid boundTo);
}

/// <summary>
/// AES-256-GCM (NIST SP 800-38D): a fresh random 96-bit nonce per value, a
/// 128-bit tag, and the row id as associated data. Stored as nonce ‖ tag ‖
/// ciphertext — text as <c>v1:</c> + base64, a file as version byte 0x01 + bytes —
/// so a later key or algorithm can sit next to it.
///
/// The key is derived with HKDF-SHA256 (RFC 5869) from the receipt vault key
/// (<see cref="ReceiptVaultOptions"/>, already set on both VMs): one secret to
/// keep and back up, while chat and receipts never share an actual key.
/// </summary>
public class AesGcmChatCipher(IOptions<ReceiptVaultOptions> options) : IChatCipher, ITransientDependency
{
    private const string TextPrefix = "v1:";
    private const byte FileVersion = 0x01;
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private static readonly byte[] KeyInfo = Encoding.UTF8.GetBytes("bluedental/chat/v1");

    public string EncryptText(string plain, Guid boundTo) =>
        TextPrefix + Convert.ToBase64String(Seal(Encoding.UTF8.GetBytes(plain), boundTo));

    public string DecryptText(string cipher, Guid boundTo)
    {
        if (!cipher.StartsWith(TextPrefix, StringComparison.Ordinal))
        {
            throw new CryptographicException("Unknown chat cipher format.");
        }

        return Encoding.UTF8.GetString(Open(Convert.FromBase64String(cipher[TextPrefix.Length..]), boundTo));
    }

    public byte[] SealFile(ReadOnlySpan<byte> plain, Guid boundTo)
    {
        var core = Seal(plain, boundTo);
        var file = new byte[1 + core.Length];
        file[0] = FileVersion;
        core.CopyTo(file, 1);
        return file;
    }

    public byte[] OpenFile(byte[] sealedFile, Guid boundTo)
    {
        if (sealedFile.Length < 1 + NonceSize + TagSize || sealedFile[0] != FileVersion)
        {
            throw new CryptographicException("Unknown chat file format.");
        }

        return Open(sealedFile.AsSpan(1), boundTo);
    }

    private byte[] Seal(ReadOnlySpan<byte> plain, Guid boundTo)
    {
        var sealedBytes = new byte[NonceSize + TagSize + plain.Length];
        var nonce = sealedBytes.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);
        using var aes = new AesGcm(Key(), TagSize);
        aes.Encrypt(
            nonce,
            plain,
            sealedBytes.AsSpan(NonceSize + TagSize),
            sealedBytes.AsSpan(NonceSize, TagSize),
            boundTo.ToByteArray());
        return sealedBytes;
    }

    private byte[] Open(ReadOnlySpan<byte> sealedBytes, Guid boundTo)
    {
        if (sealedBytes.Length < NonceSize + TagSize)
        {
            throw new CryptographicException("Chat ciphertext is too short.");
        }

        var plain = new byte[sealedBytes.Length - NonceSize - TagSize];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Decrypt(
            sealedBytes[..NonceSize],
            sealedBytes[(NonceSize + TagSize)..],
            sealedBytes.Slice(NonceSize, TagSize),
            plain,
            boundTo.ToByteArray());
        return plain;
    }

    private byte[] Key()
    {
        byte[]? vaultKey = null;
        var configured = options.Value.Key;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            try
            {
                vaultKey = Convert.FromBase64String(configured.Trim());
            }
            catch (FormatException)
            {
                vaultKey = null;
            }
        }

        if (vaultKey is not { Length: 32 })
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptVaultKeyMissing);
        }

        return HKDF.DeriveKey(HashAlgorithmName.SHA256, vaultKey, 32, info: KeyInfo);
    }
}
