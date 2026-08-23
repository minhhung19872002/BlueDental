using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.PermissionManagement;

namespace BlueDental.Data;

/// <summary>
/// Grants the whole ability catalog to the admin role.
///
/// The reference's <c>clinicAdmin</c> role holds every one of the 83 subjects,
/// so the equivalent BlueDental role must too — otherwise every screen 403s the
/// moment the new ability checks are enforced. Roles below clinic admin are
/// configured by an operator, exactly as on the reference.
/// </summary>
public class BlueDentalAbilitySeedContributor(
    IPermissionDataSeeder permissionDataSeeder) : IDataSeedContributor, ITransientDependency
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
        var permissionNames = BlueDentalAbilities
            .All()
            .Select(pair => BlueDentalAbilities.Permission(pair.Subject, pair.Action))
            .ToArray();

        await permissionDataSeeder.SeedAsync(
            RoleProviderName,
            AdminRoleName,
            permissionNames,
            context?.TenantId);
    }
}
