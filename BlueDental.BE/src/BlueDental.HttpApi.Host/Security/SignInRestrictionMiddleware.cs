using System;
using System.Security.Principal;
using System.Threading.Tasks;
using BlueDental.Account;
using BlueDental.Localization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Security;

/// <summary>
/// Ends a session that is used from outside the account's branch networks
/// (Cụm 11 mục 11) or past its branches' allowed hours (mục 13). Sign-in
/// already refuses both; this covers the laptop that signed in at the clinic
/// and carries on from home, and the session still open when the hours end.
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

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var userId = context.User.FindUserId();
        if (userId is null)
        {
            await next(context);
            return;
        }

        var address = signInGuard.ClientAddress;
        var refusal = await cache.GetOrCreateAsync($"sign-in-restriction:{userId}:{address}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return signInGuard.CheckAsync(userId.Value, address, DateTimeOffset.UtcNow);
        });

        if (refusal is null)
        {
            await next(context);
            return;
        }

        logger.LogWarning("Session of user {UserId} from {ClientAddress} ended: {Code}.",
            userId, address, refusal.Code);

        await context.SignOutAsync(IdentityConstants.ApplicationScheme);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        var message = localizer[refusal.Code].Value.Replace("{hours}", refusal.Hours ?? string.Empty);
        await context.Response.WriteAsJsonAsync(new { error = new { code = refusal.Code, message } });
    }
}
