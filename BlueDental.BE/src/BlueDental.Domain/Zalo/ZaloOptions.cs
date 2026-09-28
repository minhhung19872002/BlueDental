namespace BlueDental.Zalo;

/// <summary>
/// The <c>Zalo</c> configuration section. App id and secret come from the
/// Zalo developer portal; the OA secret key is the one the portal shows on the
/// webhook page. The bootstrap tokens are optional: a pair copied from the
/// portal's token tool so a deployment can be connected without the OAuth
/// round trip. None of these belong in a committed file.
/// </summary>
public class ZaloOptions
{
    public const string SectionName = "Zalo";

    public string AppId { get; set; } = string.Empty;
    public string AppSecret { get; set; } = string.Empty;

    /// <summary>The OA this deployment is meant to connect; empty accepts any.</summary>
    public string OaId { get; set; } = string.Empty;

    /// <summary>OA secret key used to sign webhook events.</summary>
    public string WebhookSecret { get; set; } = string.Empty;

    public string BootstrapAccessToken { get; set; } = string.Empty;
    public string BootstrapRefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// The redirect URI registered in the portal. Empty derives
    /// <c>{App:SelfUrl}/api/v1/app/zalo/oauth/callback</c>.
    /// </summary>
    public string CallbackUrl { get; set; } = string.Empty;

    /// <summary>
    /// Where the browser lands after the OAuth callback. Empty derives
    /// <c>{App:ClientUrl}/tools/zalo-oa</c>.
    /// </summary>
    public string ReturnUrl { get; set; } = string.Empty;

    public string OAuthBaseUrl { get; set; } = "https://oauth.zaloapp.com";
    public string OpenApiBaseUrl { get; set; } = "https://openapi.zalo.me";
    public string BusinessApiBaseUrl { get; set; } = "https://business.openapi.zalo.me";

    public bool HasAppCredentials =>
        !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(AppSecret);

    public bool HasBootstrapTokens =>
        !string.IsNullOrWhiteSpace(BootstrapAccessToken) && !string.IsNullOrWhiteSpace(BootstrapRefreshToken);
}
