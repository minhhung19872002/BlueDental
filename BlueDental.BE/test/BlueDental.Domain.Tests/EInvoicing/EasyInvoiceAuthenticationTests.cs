using System;
using Xunit;

namespace BlueDental.EInvoicing;

public class EasyInvoiceAuthenticationTests
{
    // 2023-11-14T22:13:20Z — the unix second the provider expects in the header.
    private static readonly DateTimeOffset At = DateTimeOffset.FromUnixTimeSeconds(1700000000);
    private static readonly Guid Nonce = Guid.Parse("0123456789abcdef0123456789abcdef");

    [Fact]
    public void Header_Has_Six_Colon_Separated_Parts_In_Provider_Order()
    {
        var header = EasyInvoiceAuthentication.BuildHeader("API", "secret", "0318531468", At, Nonce);

        var parts = header.Split(':');
        Assert.Equal(6, parts.Length);
        Assert.Equal("FFKrnqK0oPQAzCfZDGI1/A==", parts[0]);
        Assert.Equal("0123456789abcdef0123456789abcdef", parts[1]);
        Assert.Equal("1700000000", parts[2]);
        Assert.Equal("API", parts[3]);
        Assert.Equal("secret", parts[4]);
        Assert.Equal("0318531468", parts[5]);
    }

    [Fact]
    public void Signature_Is_Base64_Md5_Of_Post_Timestamp_Nonce()
    {
        Assert.Equal("FFKrnqK0oPQAzCfZDGI1/A==", EasyInvoiceAuthentication.Sign(1700000000, "0123456789abcdef0123456789abcdef"));
    }

    [Fact]
    public void Timestamp_Is_Taken_In_Utc_Whatever_The_Offset()
    {
        var local = At.ToOffset(TimeSpan.FromHours(7));
        Assert.Equal(
            EasyInvoiceAuthentication.BuildHeader("API", "x", "1", At, Nonce),
            EasyInvoiceAuthentication.BuildHeader("API", "x", "1", local, Nonce));
    }

    [Fact]
    public void Header_Names_Match_The_Provider()
    {
        Assert.Equal("Authentication", EasyInvoiceAuthentication.HeaderName);
        Assert.Equal("Admin-Agent", EasyInvoiceAuthentication.AgentHeaderName);
        Assert.Equal("easyinvoice.vn", EasyInvoiceAuthentication.AgentHeaderValue);
    }
}
