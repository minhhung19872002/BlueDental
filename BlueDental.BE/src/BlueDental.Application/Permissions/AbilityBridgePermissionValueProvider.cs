using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.Authorization.Permissions;

namespace BlueDental.Permissions;

/// <summary>
/// Grants a legacy module permission when the caller holds any of the ability
/// leaves <see cref="BlueDentalPermissionBridge"/> maps it to.
///
/// ABP asks its value providers in registration order and stops at the first
/// definite answer, so this one runs after the user, role and client
/// providers: a role that was seeded with the legacy name directly is still
/// granted by the role provider, and only the undecided names reach here. It
/// answers <see cref="PermissionGrantResult.Undefined"/> for anything it does
/// not bridge, never Prohibited, so it can only widen, never narrow.
///
/// Ability names are never bridged themselves, so the nested check below
/// cannot recurse back into this provider.
/// </summary>
public class AbilityBridgePermissionValueProvider : PermissionValueProvider
{
    public const string ProviderName = "AB";

    private readonly IServiceProvider _serviceProvider;

    public AbilityBridgePermissionValueProvider(
        IPermissionStore permissionStore,
        IServiceProvider serviceProvider)
        : base(permissionStore)
    {
        _serviceProvider = serviceProvider;
    }

    public override string Name => ProviderName;

    public override async Task<PermissionGrantResult> CheckAsync(PermissionValueCheckContext context)
    {
        var abilities = BlueDentalPermissionBridge.AbilitiesFor(context.Permission.Name);
        if (abilities.Count == 0 || context.Principal is null)
        {
            return PermissionGrantResult.Undefined;
        }

        var checker = _serviceProvider.GetRequiredService<IPermissionChecker>();
        var result = await checker.IsGrantedAsync(context.Principal, abilities.ToArray());

        return AnyGranted(result, abilities) ? PermissionGrantResult.Granted : PermissionGrantResult.Undefined;
    }

    public override async Task<MultiplePermissionGrantResult> CheckAsync(PermissionValuesCheckContext context)
    {
        var names = context.Permissions.Select(p => p.Name).ToArray();
        var result = new MultiplePermissionGrantResult(names);

        var bridged = names.Where(BlueDentalPermissionBridge.IsBridged).ToList();
        if (bridged.Count == 0 || context.Principal is null)
        {
            return result;
        }

        // One round trip for the whole batch: every ability any bridged name
        // needs, checked together, then each legacy name reads its own slice.
        var needed = bridged
            .SelectMany(BlueDentalPermissionBridge.AbilitiesFor)
            .Distinct()
            .ToArray();

        var checker = _serviceProvider.GetRequiredService<IPermissionChecker>();
        var abilityResult = await checker.IsGrantedAsync(context.Principal, needed);

        foreach (var name in bridged)
        {
            if (AnyGranted(abilityResult, BlueDentalPermissionBridge.AbilitiesFor(name)))
            {
                result.Result[name] = PermissionGrantResult.Granted;
            }
        }

        return result;
    }

    private static bool AnyGranted(MultiplePermissionGrantResult result, IEnumerable<string> abilities) =>
        abilities.Any(a => result.Result.TryGetValue(a, out var grant) && grant == PermissionGrantResult.Granted);
}
