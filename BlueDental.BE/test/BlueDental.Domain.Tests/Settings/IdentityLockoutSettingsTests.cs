using System.Collections.Generic;
using BlueDental.Settings;
using Volo.Abp.Identity.Settings;
using Volo.Abp.Settings;
using Xunit;

namespace BlueDental.Domain.Tests.Settings;

/// <summary>
/// The lockout numbers are the ones the clinic agreed on: 10 wrong passwords,
/// then a 5 minute lock. ABP ships 5 attempts, so this feeds the provider the
/// framework defaults and checks ours replaces them.
/// </summary>
public class IdentityLockoutSettingsTests
{
    private static readonly string[] AbpDefaults =
    [
        "5",    // Lockout.MaxFailedAccessAttempts
        "300",  // Lockout.LockoutDuration, in seconds
    ];

    private static IDictionary<string, SettingDefinition> DefinitionsAfterOverride()
    {
        var definitions = new Dictionary<string, SettingDefinition>
        {
            [IdentitySettingNames.Lockout.MaxFailedAccessAttempts] =
                new SettingDefinition(IdentitySettingNames.Lockout.MaxFailedAccessAttempts, AbpDefaults[0]),
            [IdentitySettingNames.Lockout.LockoutDuration] =
                new SettingDefinition(IdentitySettingNames.Lockout.LockoutDuration, AbpDefaults[1]),
        };

        new BlueDentalIdentitySettingDefinitionProvider().Define(new SettingDefinitionContext(definitions));

        return definitions;
    }

    [Fact]
    public void Should_Lock_The_Account_After_Ten_Failed_Attempts()
    {
        var definitions = DefinitionsAfterOverride();

        Assert.Equal("10", definitions[IdentitySettingNames.Lockout.MaxFailedAccessAttempts].DefaultValue);
    }

    [Fact]
    public void Should_Keep_The_Lock_For_Five_Minutes()
    {
        var definitions = DefinitionsAfterOverride();

        Assert.Equal("300", definitions[IdentitySettingNames.Lockout.LockoutDuration].DefaultValue);
    }

    [Fact]
    public void Should_Not_Fail_When_A_Setting_Is_Missing()
    {
        var definitions = new Dictionary<string, SettingDefinition>();

        new BlueDentalIdentitySettingDefinitionProvider().Define(new SettingDefinitionContext(definitions));

        Assert.Empty(definitions);
    }
}
