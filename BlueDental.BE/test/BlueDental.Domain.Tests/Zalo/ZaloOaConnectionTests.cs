using System;
using BlueDental.Zalo;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class ZaloOaConnectionTests
{
    private static readonly DateTime Now = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);

    private static ZaloTokenSet Tokens(DateTime now) =>
        new("access-cipher", "refresh-cipher", now.AddHours(25), now.AddDays(90));

    private static ZaloOaConnection Connect() =>
        new(Guid.NewGuid(), Guid.NewGuid(), "4064643284282198510", "Nha khoa", Tokens(Now), Now);

    [Fact]
    public void New_connection_is_active_and_enabled()
    {
        var c = Connect();

        c.IsConnected.ShouldBeTrue();
        c.IsEnabled.ShouldBeTrue();
        c.CanSend.ShouldBeTrue();
        c.Status.ShouldBe(ZaloOaConnectionStatus.Active);
        c.ConnectedAt.ShouldBe(Now);
        c.LastRefreshedAt.ShouldBe(Now);
    }

    [Fact]
    public void Refresh_is_due_inside_the_leeway_window()
    {
        var c = Connect();

        c.IsRefreshDue(Now).ShouldBeFalse();
        c.IsRefreshDue(Now.AddHours(23)).ShouldBeTrue();
        c.IsRefreshDue(Now.AddHours(30)).ShouldBeTrue();
    }

    [Fact]
    public void Refresh_failure_before_refresh_token_expiry_is_failed_not_expired()
    {
        var c = Connect();

        c.RecordRefreshFailure("Zalo said no", Now.AddDays(1));

        c.Status.ShouldBe(ZaloOaConnectionStatus.Failed);
        c.IsConnected.ShouldBeFalse();
        c.CanSend.ShouldBeFalse();
        c.LastError.ShouldBe("Zalo said no");
    }

    [Fact]
    public void Refresh_failure_after_refresh_token_expiry_is_expired()
    {
        var c = Connect();

        c.RecordRefreshFailure(null, Now.AddDays(91));

        c.Status.ShouldBe(ZaloOaConnectionStatus.Expired);
        c.LastError.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public void Replacing_tokens_recovers_a_failed_connection_and_clears_the_error()
    {
        var c = Connect();
        c.RecordRefreshFailure("boom", Now.AddDays(1));

        var later = Now.AddDays(2);
        c.ReplaceTokens(Tokens(later), later);

        c.Status.ShouldBe(ZaloOaConnectionStatus.Active);
        c.LastError.ShouldBeNull();
        c.LastRefreshedAt.ShouldBe(later);
        c.AccessTokenExpiresAt.ShouldBe(later.AddHours(25));
    }

    [Fact]
    public void Enabling_a_non_active_connection_is_refused()
    {
        var c = Connect();
        c.RecordRefreshFailure("boom", Now);
        c.SetEnabled(false);

        var ex = Should.Throw<BusinessException>(() => c.SetEnabled(true));
        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.ZaloNotConnected);
    }

    [Fact]
    public void Disabling_is_always_allowed_and_blocks_sending()
    {
        var c = Connect();

        c.SetEnabled(false);

        c.CanSend.ShouldBeFalse();
        var ex = Should.Throw<BusinessException>(() => c.EnsureCanSend());
        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.ZaloNotEnabled);
    }

    [Fact]
    public void Ensure_can_send_reports_not_connected_before_not_enabled()
    {
        var c = Connect();
        c.SetEnabled(false);
        c.RecordRefreshFailure("boom", Now);

        var ex = Should.Throw<BusinessException>(() => c.EnsureCanSend());
        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.ZaloNotConnected);
    }

    [Fact]
    public void Oa_info_clips_long_values_and_falls_back_to_the_id_for_a_blank_name()
    {
        var c = Connect();

        c.SetOaInfo("123", " ", new string('u', 600), null);

        c.OaName.ShouldBe("123");
        c.AvatarUrl!.Length.ShouldBe(ZaloOaConnection.MaxUrlLength);
        c.PackageName.ShouldBeNull();
    }
}
