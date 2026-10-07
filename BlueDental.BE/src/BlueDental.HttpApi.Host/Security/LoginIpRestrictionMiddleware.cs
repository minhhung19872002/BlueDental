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
/// (Cụm 11 mục 11). Sign-in already refuses such an address; this covers the
/// laptop that signed in at the clinic and carries on from home.
///
/// The answer is cached per account and address for a minute, so the check
/// costs one lookup a minute rather than one per request, and a changed IP
/// list or "Cho phép đăng nhập ngoài công ty" tick takes effect within that
/// minute.
/// </summary>
public class LoginIpRestrictionMiddleware(
    LoginIpGuard loginIpGuard,
    IMemoryCache cache,
    IStringLocalizer<BlueDentalResource> localizer,
    ILogger<LoginIpRestrictionMiddleware> logger) : IMiddleware, ITransientDependency
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

        var address = loginIpGuard.ClientAddress;
        var allowed = await cache.GetOrCreateAsync($"login-ip:{userId}:{address}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return loginIpGuard.IsAllowedAsync(userId.Value, address);
        });

        if (allowed)
        {
            await next(context);
            return;
        }

        logger.LogWarning("Session of user {UserId} ended: address {ClientAddress} is outside its branch networks.",
            userId, address);

        await context.SignOutAsync(IdentityConstants.ApplicationScheme);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        var code = BlueDentalDomainErrorCodes.Authentication.LoginIpNotAllowed;
        await context.Response.WriteAsJsonAsync(new { error = new { code, message = localizer[code].Value } });
    }
}
