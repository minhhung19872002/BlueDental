using Volo.Abp.Identity.Settings;
using Volo.Abp.Settings;

namespace BlueDental.Settings;

/// <summary>
/// ABP locks an account after 5 failed sign-ins by default, which reception
/// staff hit while simply mistyping a password. The clinic asked for 10
/// attempts instead, keeping the 5 minute lock so a real brute-force attempt
/// still costs the attacker time.
/// </summary>
/// <remarks>
/// These are default values of the existing ABP settings, so a value written
/// through Setting Management (the <c>AbpSettings</c> table) still wins.
/// </remarks>
public class BlueDentalIdentitySettingDefinitionProvider : SettingDefinitionProvider
{
    public const string MaxFailedAccessAttempts = "10";
    public const string LockoutDurationSeconds = "300";

    public override void Define(ISettingDefinitionContext context)
    {
        var maxFailedAccessAttempts = context.GetOrNull(
            IdentitySettingNames.Lockout.MaxFailedAccessAttempts);
        if (maxFailedAccessAttempts != null)
        {
            maxFailedAccessAttempts.DefaultValue = MaxFailedAccessAttempts;
        }

        var lockoutDuration = context.GetOrNull(IdentitySettingNames.Lockout.LockoutDuration);
        if (lockoutDuration != null)
        {
            lockoutDuration.DefaultValue = LockoutDurationSeconds;
        }
    }
}
