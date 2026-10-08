using System;
using System.Linq;
using System.Security.Principal;
using System.Threading.Tasks;
using BlueDental.Account;
using BlueDental.Localization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Security;

/// <summary>
/// Refuses a session that is used from outside the account's branch networks
/// (Cụm 11 mục 11) or past its branches' allowed hours (mục 13). Sign-in
/// already refuses both; this covers the laptop that signed in at the clinic
/// and carries on from home, and the session still open when the hours end.
///
/// Every request of such a session is answered 401 with the reason's code,
/// and the cookie is left alone: signing out on the first refusal let a later
/// request (the screen's own, after a SignalR call got there first) come back
/// as a bare 401, and the login screen lost the reason (R-831).
///
/// The answer is cached per account and address for a minute, so the check
/// costs one lookup a minute rather than one per request; a changed list,
/// window or tick — and the end of the window itself — takes effect within
/// that minute.
/// </summary>
public class SignInRestrictionMiddleware(
    SignInRestrictionGuard signInGuard,
    IMemoryCache cache,
    IStringLocalizer<BlueDentalResource> localizer,
    ILogger<SignInRestrictionMiddleware> logger) : IMiddleware, ITransientDependency
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Let through whatever the login screen itself needs: the app's start-up
    /// configuration and texts (a refusal there showed "Hệ thống đang bảo trì"
    /// instead of the login form), and signing in or out. Signing in is
    /// checked by the sign-in manager; nothing here returns business data.
    /// </summary>
    private static readonly string[] OpenPaths =
    [
        "/api/abp/application-configuration",
        "/api/abp/application-localization",
        "/api/account/login",
        "/api/account/logout",
    ];

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var userId = context.User.FindUserId();
        if (userId is null || OpenPaths.Any(path => context.Request.Path.StartsWithSegments(path)))
        {
            await next(context);
            return;
        }

        var address = signInGuard.ClientAddress;
        var refusal = await cache.GetOrCreateAsync($"sign-in-restriction:{userId}:{address}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            var answer = await signInGuard.CheckAsync(userId.Value, address, DateTimeOffset.UtcNow);
            if (answer is not null)
            {
                // Once per account, address and minute, not once per refused request.
                logger.LogWarning("Session of user {UserId} from {ClientAddress} refused: {Code}.",
                    userId, address, answer.Code);
            }

            return answer;
        });

        if (refusal is null)
        {
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        var message = localizer[refusal.Code].Value.Replace("{hours}", refusal.Hours ?? string.Empty);
        await context.Response.WriteAsJsonAsync(new { error = new { code = refusal.Code, message } });
    }
}
