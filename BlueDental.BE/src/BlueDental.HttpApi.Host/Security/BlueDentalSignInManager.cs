using System.Threading.Tasks;
using BlueDental.Account;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.Identity;
using Volo.Abp.Identity.AspNetCore;
using Volo.Abp.Settings;
using IdentityUser = Volo.Abp.Identity.IdentityUser;

namespace BlueDental.Security;

/// <summary>
/// Refuses sign-in from outside the account's branch networks (Cụm 11 mục 11).
///
/// The check sits in <see cref="SignInOrTwoFactorAsync"/>, which runs only
/// after the password has been accepted: checking earlier would tell anyone
/// who types a user name that the account exists and is IP-restricted.
/// </summary>
public class BlueDentalSignInManager(
    IdentityUserManager userManager,
    IHttpContextAccessor contextAccessor,
    IUserClaimsPrincipalFactory<IdentityUser> claimsFactory,
    IOptions<IdentityOptions> optionsAccessor,
    ILogger<SignInManager<IdentityUser>> logger,
    IAuthenticationSchemeProvider schemes,
    IUserConfirmation<IdentityUser> confirmation,
    IOptions<AbpIdentityOptions> options,
    ISettingProvider settingProvider,
    LoginIpGuard loginIpGuard)
    : AbpSignInManager(userManager, contextAccessor, claimsFactory, optionsAccessor, logger, schemes,
        confirmation, options, settingProvider)
{
    protected override async Task<SignInResult> SignInOrTwoFactorAsync(
        IdentityUser user, bool isPersistent, string? loginProvider = null, bool bypassTwoFactor = false)
    {
        if (!await loginIpGuard.IsAllowedAsync(user))
        {
            Logger.LogWarning("Sign-in refused for user {UserId}: address {ClientAddress} is outside its branch networks.",
                user.Id, loginIpGuard.ClientAddress);
            throw new BusinessException(BlueDentalDomainErrorCodes.Authentication.LoginIpNotAllowed);
        }

        return await base.SignInOrTwoFactorAsync(user, isPersistent, loginProvider, bypassTwoFactor);
    }
}
