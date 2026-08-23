using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.PermissionManagement;

namespace BlueDental.Data;

/// <summary>
/// Grants every declared permission to the admin role.
///
/// The reference's <c>clinicAdmin</c> role holds every one of the 83 subjects,
/// so the equivalent BlueDental role must too — otherwise every screen 403s the
/// moment the checks are enforced. Roles below clinic admin are configured by an
/// operator, exactly as on the reference.
///
/// This asks the permission definitions what exists rather than naming a
/// catalogue: BlueDental grew a second one (<c>BlueDentalPermissions</c>
/// alongside the abilities), and a seeder that knew only the first left every
/// screen forbidden.
/// </summary>
public class BlueDentalAbilitySeedContributor(
    IPermissionDataSeeder permissionDataSeeder,
    IPermissionDefinitionManager permissionDefinitionManager) : IDataSeedContributor, ITransientDependency
{
    /// <summary>
    /// ABP's role permission value provider name. The constant itself lives in
    /// Volo.Abp.PermissionManagement.Domain.Identity, which this layer does not
    /// reference; the value is part of ABP's stable storage contract.
    /// </summary>
    private const string RoleProviderName = "R";

    private const string AdminRoleName = "admin";

    public async Task SeedAsync(DataSeedContext context)
    {
        var abilityNames = BlueDentalAbilities
            .All()
            .Select(pair => BlueDentalAbilities.Permission(pair.Subject, pair.Action));

        var definedNames = (await permissionDefinitionManager.GetPermissionsAsync())
            .Select(definition => definition.Name);

        var permissionNames = abilityNames.Concat(definedNames).Distinct().ToArray();

        await permissionDataSeeder.SeedAsync(
            RoleProviderName,
            AdminRoleName,
            permissionNames,
            context?.TenantId);
    }
}
