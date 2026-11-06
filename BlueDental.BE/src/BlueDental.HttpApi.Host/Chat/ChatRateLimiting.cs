using System;
using System.Globalization;
using System.Security.Principal;
using System.Threading.RateLimiting;
using BlueDental.Localization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;

namespace BlueDental.Chat;

/// <summary>
/// Per-account sliding windows on chat sending, uploading and searching
/// (R-1158). A refused request answers 429 with the usual ABP error body, so
/// the screen shows "Bạn gửi quá nhanh…" like any other business error.
/// </summary>
public static class ChatRateLimiting
{
    private const int SegmentsPerWindow = 3;

    public static IServiceCollection AddChatRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var limits = configuration.GetSection($"{ChatOptions.SectionName}:{nameof(ChatOptions.RateLimit)}").Get<ChatRateLimitOptions>()
            ?? new ChatRateLimitOptions();
        var window = TimeSpan.FromSeconds(Math.Max(1, limits.WindowSeconds));

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(ChatRateLimitPolicies.Send, http => PerAccount(http, limits.SendPermits, window));
            options.AddPolicy(ChatRateLimitPolicies.Upload, http => PerAccount(http, limits.UploadPermits, window));
            options.AddPolicy(ChatRateLimitPolicies.Search, http => PerAccount(http, limits.SearchPermits, window));
            options.OnRejected = async (context, cancellationToken) =>
            {
                var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait) ? wait : window;
                var response = context.HttpContext.Response;
                response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);

                var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<BlueDentalResource>>();
                var code = BlueDentalDomainErrorCodes.Chat.SendingTooFast;
                await response.WriteAsJsonAsync(
                    new { error = new { code, message = localizer[code].Value } },
                    cancellationToken);
            };
        });
    }

    /// <summary>Requests reach here signed in ([Authorize] runs first); the address is a fallback only.</summary>
    private static RateLimitPartition<string> PerAccount(HttpContext http, int permits, TimeSpan window)
    {
        var key = http.User.FindUserId()?.ToString() ?? http.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
        return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = Math.Max(1, permits),
            Window = window,
            SegmentsPerWindow = SegmentsPerWindow,
            QueueLimit = 0,
        });
    }
}
