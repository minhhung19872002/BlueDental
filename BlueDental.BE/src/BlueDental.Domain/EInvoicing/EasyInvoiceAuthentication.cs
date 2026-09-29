using System;
using System.Security.Cryptography;
using System.Text;

namespace BlueDental.EInvoicing;

/// <summary>
/// The provider's request signature (docs/clone/integrations/easyinvoice.md,
/// verified end to end 2026-09-28):
///
/// <code>
/// Admin-Agent: easyinvoice.vn
/// Authentication: {sig}:{nonce}:{ts}:{username}:{password}:{taxCode}
/// sig = Base64(MD5(UTF8("POST" + ts + nonce)))
/// </code>
///
/// <c>ts</c> is UTC Unix seconds, <c>nonce</c> a lower-case 32-hex GUID. The
/// signature covers only the method, time and nonce — never the body — so the
/// same helper serves every endpoint. MD5 here is the provider's contract, not
/// a security choice of ours.
/// </summary>
public static class EasyInvoiceAuthentication
{
    public const string HeaderName = "Authentication";
    public const string AgentHeaderName = "Admin-Agent";
    public const string AgentHeaderValue = "easyinvoice.vn";

    public static string BuildHeader(
        string username, string password, string taxCode, DateTimeOffset now, Guid nonce)
    {
        var timestamp = now.ToUnixTimeSeconds();
        var nonceText = nonce.ToString("N").ToLowerInvariant();
        return $"{Sign(timestamp, nonceText)}:{nonceText}:{timestamp}:{username}:{password}:{taxCode}";
    }

    public static string Sign(long timestamp, string nonce)
    {
        var bytes = Encoding.UTF8.GetBytes($"POST{timestamp}{nonce}");
        return Convert.ToBase64String(MD5.HashData(bytes));
    }
}
