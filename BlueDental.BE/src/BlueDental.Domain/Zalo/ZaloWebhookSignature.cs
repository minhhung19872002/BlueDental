using System;
using System.Security.Cryptography;
using System.Text;

namespace BlueDental.Zalo;

/// <summary>
/// Zalo signs each webhook call with <c>X-ZEvent-Signature: mac=&lt;hex&gt;</c>
/// where the mac is <c>sha256(appId + body + timestamp + oaSecretKey)</c>, the
/// timestamp being the event's own <c>timestamp</c> field.
/// </summary>
public static class ZaloWebhookSignature
{
    public const string HeaderName = "X-ZEvent-Signature";

    public static string Compute(string appId, string body, string timestamp, string oaSecretKey)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(appId + body + timestamp + oaSecretKey));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>Accepts the header with or without its <c>mac=</c> prefix, any case.</summary>
    public static bool Verify(string? header, string appId, string body, string timestamp, string oaSecretKey)
    {
        if (string.IsNullOrWhiteSpace(header))
        {
            return false;
        }

        var presented = header.Trim();
        if (presented.StartsWith("mac=", StringComparison.OrdinalIgnoreCase))
        {
            presented = presented[4..];
        }

        var expected = Compute(appId, body, timestamp, oaSecretKey);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(presented.ToLowerInvariant()),
            Encoding.ASCII.GetBytes(expected));
    }
}
