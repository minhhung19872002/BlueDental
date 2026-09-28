using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace BlueDental.Zalo;

/// <summary>
/// The <c>state</c> that rides through Zalo's consent screen and back. It
/// names the branch the link is for and is signed with the app secret, so a
/// callback cannot be forged or replayed onto another branch, and it lapses
/// so a stale link cannot be finished later. Format:
/// <c>base64url(branchId|expiresUnix|hmacHex)</c>.
/// </summary>
public static class ZaloOAuthState
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    public static string Create(Guid clinicBranchId, DateTime now, string secret)
    {
        var expires = new DateTimeOffset(now, TimeSpan.Zero).Add(Lifetime).ToUnixTimeSeconds();
        var payload = $"{clinicBranchId:N}|{expires.ToString(CultureInfo.InvariantCulture)}";
        var mac = Sign(payload, secret);
        return Base64UrlEncode(Encoding.ASCII.GetBytes(payload + "|" + mac));
    }

    /// <summary>The branch the state was issued for, or null when it is forged or stale.</summary>
    public static Guid? Read(string? state, DateTime now, string secret)
    {
        if (string.IsNullOrWhiteSpace(state))
        {
            return null;
        }

        string decoded;
        try
        {
            decoded = Encoding.ASCII.GetString(Base64UrlDecode(state));
        }
        catch (FormatException)
        {
            return null;
        }

        var parts = decoded.Split('|');
        if (parts.Length != 3
            || !Guid.TryParseExact(parts[0], "N", out var branchId)
            || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var expires))
        {
            return null;
        }

        var expected = Sign(parts[0] + "|" + parts[1], secret);
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(parts[2]), Encoding.ASCII.GetBytes(expected)))
        {
            return null;
        }

        var nowUnix = new DateTimeOffset(now, TimeSpan.Zero).ToUnixTimeSeconds();
        return expires < nowUnix ? null : branchId;
    }

    private static string Sign(string payload, string secret)
    {
        var mac = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes(payload));
        return Convert.ToHexString(mac).ToLowerInvariant();
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string text)
    {
        var padded = text.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
