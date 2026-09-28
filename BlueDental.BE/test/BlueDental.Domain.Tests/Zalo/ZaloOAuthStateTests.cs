using System;
using BlueDental.Zalo;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class ZaloOAuthStateTests
{
    private static readonly DateTime Now = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);
    private const string Secret = "app-secret";

    [Fact]
    public void Round_trips_the_branch_within_its_lifetime()
    {
        var branchId = Guid.NewGuid();

        var state = ZaloOAuthState.Create(branchId, Now, Secret);

        ZaloOAuthState.Read(state, Now.AddMinutes(5), Secret).ShouldBe(branchId);
    }

    [Fact]
    public void Rejects_a_stale_state()
    {
        var state = ZaloOAuthState.Create(Guid.NewGuid(), Now, Secret);

        ZaloOAuthState.Read(state, Now.Add(ZaloOAuthState.Lifetime).AddSeconds(1), Secret).ShouldBeNull();
    }

    [Fact]
    public void Rejects_a_state_signed_with_another_secret_or_tampered()
    {
        var state = ZaloOAuthState.Create(Guid.NewGuid(), Now, Secret);

        ZaloOAuthState.Read(state, Now, "other").ShouldBeNull();
        ZaloOAuthState.Read(state + "x", Now, Secret).ShouldBeNull();
        ZaloOAuthState.Read(null, Now, Secret).ShouldBeNull();
        ZaloOAuthState.Read("not-base64!", Now, Secret).ShouldBeNull();
    }
}
