using System;
using System.Security.Cryptography;
using System.Text;
using BlueDental.Zalo;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class ZaloWebhookSignatureTests
{
    private const string AppId = "2550837064944804109";
    private const string Secret = "oa-secret";
    private const string Body = "{\"event_name\":\"user_send_text\",\"timestamp\":\"1700000000000\"}";
    private const string Timestamp = "1700000000000";

    [Fact]
    public void Compute_is_sha256_of_appid_body_timestamp_secret()
    {
        var expected = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(AppId + Body + Timestamp + Secret))).ToLowerInvariant();

        ZaloWebhookSignature.Compute(AppId, Body, Timestamp, Secret).ShouldBe(expected);
    }

    [Fact]
    public void Verify_accepts_the_mac_prefixed_header_zalo_sends()
    {
        var mac = ZaloWebhookSignature.Compute(AppId, Body, Timestamp, Secret);

        ZaloWebhookSignature.Verify("mac=" + mac, AppId, Body, Timestamp, Secret).ShouldBeTrue();
        ZaloWebhookSignature.Verify(mac, AppId, Body, Timestamp, Secret).ShouldBeTrue();
    }

    [Fact]
    public void Verify_rejects_a_missing_or_tampered_signature()
    {
        var mac = ZaloWebhookSignature.Compute(AppId, Body, Timestamp, Secret);

        ZaloWebhookSignature.Verify(null, AppId, Body, Timestamp, Secret).ShouldBeFalse();
        ZaloWebhookSignature.Verify("mac=" + mac, AppId, Body + " ", Timestamp, Secret).ShouldBeFalse();
        ZaloWebhookSignature.Verify("mac=" + mac, AppId, Body, Timestamp, "other").ShouldBeFalse();
    }
}
