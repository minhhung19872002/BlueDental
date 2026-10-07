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
/// Refuses sign-in from outside the account's branch networks (Cụm 11 mục 11)
/// or outside its branches' allowed hours (mục 13).
///
/// The check sits in <see cref="SignInOrTwoFactorAsync"/>, which runs only
/// after the password has been accepted: checking earlier would tell anyone
/// who types a user name that the account exists and is restricted.
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
    SignInRestrictionGuard signInGuard)
    : AbpSignInManager(userManager, contextAccessor, claimsFactory, optionsAccessor, logger, schemes,
        confirmation, options, settingProvider)
{
    protected override async Task<SignInResult> SignInOrTwoFactorAsync(
        IdentityUser user, bool isPersistent, string? loginProvider = null, bool bypassTwoFactor = false)
    {
        var refusal = await signInGuard.CheckAsync(user);
        if (refusal is not null)
        {
            Logger.LogWarning("Sign-in refused for user {UserId} from {ClientAddress}: {Code}.",
                user.Id, signInGuard.ClientAddress, refusal.Code);

            var exception = new BusinessException(refusal.Code);
            if (refusal.Hours is not null) exception.WithData("hours", refusal.Hours);
            throw exception;
        }

        return await base.SignInOrTwoFactorAsync(user, isPersistent, loginProvider, bypassTwoFactor);
    }
}
