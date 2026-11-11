using System.Security.Cryptography;
using System.Text;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent;

/// <summary>DPAPI, current Windows user: another account on the PC cannot read the token.</summary>
internal sealed class DpapiTokenProtector : ITokenProtector
{
    private static readonly byte[] Entropy = "BlueDental.XrayAgent.Token.v1"u8.ToArray();

    public string Protect(string token) => Convert.ToBase64String(
        ProtectedData.Protect(Encoding.UTF8.GetBytes(token), Entropy, DataProtectionScope.CurrentUser));

    public string? Unprotect(string protectedToken)
    {
        try
        {
            var raw = ProtectedData.Unprotect(Convert.FromBase64String(protectedToken), Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(raw);
        }
        catch (Exception e) when (e is CryptographicException or FormatException)
        {
            return null;
        }
    }
}
