using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.Extensions.Logging;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Guids;
using Volo.Abp.Identity;
using Volo.Abp.PermissionManagement;

namespace BlueDental.Data;

/// <summary>
/// Seeds the three system roles and their permissions.
///
/// <list type="bullet">
/// <item><c>admin</c> — all permissions (clinic-wide, unrestricted)</item>
/// <item><c>Quản lý phòng khám</c> — all permissions except creating new branches</item>
/// <item><c>Quản lý chi nhánh</c> — branch-scoped; settings limited to personal info / password</item>
/// </list>
///
/// All three are marked <c>IsStatic</c> so they cannot be deleted/renamed and
/// are hidden from the operator-facing permission UI.
/// </summary>
public class BlueDentalAbilitySeedContributor(
    IPermissionDataSeeder permissionDataSeeder,
    IPermissionDefinitionManager permissionDefinitionManager,
    IdentityRoleManager roleManager,
    IGuidGenerator guidGenerator,
    ILogger<BlueDentalAbilitySeedContributor> logger) : IDataSeedContributor, ITransientDependency
{
    private const string RoleProviderName = "R";

    public const string AdminRoleName = "admin";
    public const string ClinicManagerRoleName = "Quản lý phòng khám";
    public const string BranchManagerRoleName = "Quản lý chi nhánh";

    public async Task SeedAsync(DataSeedContext context)
    {
        var tenantId = context?.TenantId;

        var allPermissionNames = await GetAllPermissionNamesAsync();

        await EnsureStaticRoleAsync(AdminRoleName);
        await EnsureStaticRoleAsync(ClinicManagerRoleName);
        await EnsureStaticRoleAsync(BranchManagerRoleName);

        await SeedAdminPermissionsAsync(allPermissionNames, tenantId);
        await SeedClinicManagerPermissionsAsync(allPermissionNames, tenantId);
        await SeedBranchManagerPermissionsAsync(allPermissionNames, tenantId);
    }

    private async Task<string[]> GetAllPermissionNamesAsync()
    {
        var abilityNames = BlueDentalAbilities
            .All()
            .Select(pair => BlueDentalAbilities.Permission(pair.Subject, pair.Action));

        var definedNames = (await permissionDefinitionManager.GetPermissionsAsync())
            .Select(definition => definition.Name);

        return abilityNames.Concat(definedNames).Distinct().ToArray();
    }

    private async Task EnsureStaticRoleAsync(string roleName)
    {
        var role = await roleManager.FindByNameAsync(roleName);
        if (role is null)
        {
            role = new IdentityRole(guidGenerator.Create(), roleName) { IsStatic = true, IsPublic = true };
            var result = await roleManager.CreateAsync(role);
            if (result.Succeeded)
            {
                logger.LogInformation("Created static role: {RoleName}", roleName);
            }
            else
            {
                logger.LogError("Failed to create role {RoleName}: {Errors}", roleName,
                    string.Join(", ", result.Errors.Select(e => $"{e.Code}: {e.Description}")));
            }
        }
        else if (!role.IsStatic)
        {
            role.IsStatic = true;
            await roleManager.UpdateAsync(role);
            logger.LogInformation("Marked existing role as static: {RoleName}", roleName);
        }
    }

    private async Task SeedAdminPermissionsAsync(string[] allPermissionNames, Guid? tenantId)
    {
        await permissionDataSeeder.SeedAsync(
            RoleProviderName,
            AdminRoleName,
            allPermissionNames,
            tenantId);
    }

    private async Task SeedClinicManagerPermissionsAsync(string[] allPermissionNames, Guid? tenantId)
    {
        var excluded = new[]
        {
            BlueDentalPermissions.Organizations.Create,
            BlueDentalAbilities.Permission("branchManager", BlueDentalAbilities.Actions.Create),
        };

        var permissions = allPermissionNames
            .Where(p => !excluded.Contains(p))
            .ToArray();

        await permissionDataSeeder.SeedAsync(
            RoleProviderName,
            ClinicManagerRoleName,
            permissions,
            tenantId);
    }

    private async Task SeedBranchManagerPermissionsAsync(string[] allPermissionNames, Guid? tenantId)
    {
        var excluded = new[]
        {
            BlueDentalPermissions.Organizations.Create,
            BlueDentalPermissions.Organizations.Delete,
            BlueDentalAbilities.Permission("branchManager", BlueDentalAbilities.Actions.Create),
            BlueDentalAbilities.Permission("branchManager", BlueDentalAbilities.Actions.Delete),
            BlueDentalAbilities.Permission(BlueDentalAbilities.Subjects.RolePermission, BlueDentalAbilities.Actions.Create),
            BlueDentalAbilities.Permission(BlueDentalAbilities.Subjects.RolePermission, BlueDentalAbilities.Actions.Update),
            BlueDentalAbilities.Permission(BlueDentalAbilities.Subjects.RolePermission, BlueDentalAbilities.Actions.Delete),
            BlueDentalPermissions.SystemAdministration.Default,
            BlueDentalPermissions.SystemAdministration.Users.Default,
            BlueDentalPermissions.SystemAdministration.Users.Create,
            BlueDentalPermissions.SystemAdministration.Users.Edit,
            BlueDentalPermissions.SystemAdministration.Users.Delete,
            BlueDentalPermissions.SystemAdministration.Users.ManageRoles,
            BlueDentalPermissions.SystemAdministration.Roles.Default,
            BlueDentalPermissions.SystemAdministration.Roles.Create,
            BlueDentalPermissions.SystemAdministration.Roles.Edit,
            BlueDentalPermissions.SystemAdministration.Roles.Delete,
            BlueDentalPermissions.SystemAdministration.Roles.ManagePermissions,
            BlueDentalPermissions.SystemAdministration.AuditLogs,
            BlueDentalPermissions.SystemAdministration.Settings,
        };

        var permissions = allPermissionNames
            .Where(p => !excluded.Contains(p))
            .ToArray();

        await permissionDataSeeder.SeedAsync(
            RoleProviderName,
            BranchManagerRoleName,
            permissions,
            tenantId);
    }
}
