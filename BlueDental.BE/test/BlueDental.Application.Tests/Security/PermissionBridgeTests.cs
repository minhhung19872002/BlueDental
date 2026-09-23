using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Security;

/// <summary>
/// The Phân quyền tab grants ability leaves only. Every legacy module
/// permission an AppService still names in <c>[Authorize]</c> must therefore
/// be reachable through <see cref="BlueDentalPermissionBridge"/>, or a custom
/// role can never use that service no matter what it ticks.
/// </summary>
public class PermissionBridgeTests
{
    private static readonly Assembly ApplicationAssembly = typeof(BlueDentalApplicationModule).Assembly;

    /// <summary>Every string constant declared under <see cref="BlueDentalPermissions"/>, recursively.</summary>
    private static HashSet<string> LegacyNames()
    {
        var names = new HashSet<string>();
        void Walk(Type type)
        {
            foreach (var field in type.GetFields(BindingFlags.Public | BindingFlags.Static))
            {
                if (field.IsLiteral && field.FieldType == typeof(string) && field.Name != nameof(BlueDentalPermissions.GroupName))
                    names.Add((string)field.GetRawConstantValue()!);
            }
            foreach (var nested in type.GetNestedTypes(BindingFlags.Public))
                Walk(nested);
        }
        Walk(typeof(BlueDentalPermissions));
        return names;
    }

    /// <summary>Policies named on service classes and their public methods.</summary>
    private static IEnumerable<(string Where, string Policy)> AuthorizePoliciesInUse()
    {
        foreach (var type in ApplicationAssembly.GetTypes().Where(t => t.IsClass && !t.IsAbstract))
        {
            foreach (var attr in type.GetCustomAttributes<AuthorizeAttribute>())
                if (attr.Policy is not null) yield return (type.Name, attr.Policy);

            foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                foreach (var attr in method.GetCustomAttributes<AuthorizeAttribute>())
                    if (attr.Policy is not null) yield return ($"{type.Name}.{method.Name}", attr.Policy);
        }
    }

    [Fact]
    public void Every_Legacy_Policy_In_Use_Outside_SystemAdmin_Should_Be_Bridged()
    {
        var legacy = LegacyNames();

        var unbridged = AuthorizePoliciesInUse()
            .Where(p => legacy.Contains(p.Policy))
            .Where(p => !p.Policy.StartsWith(BlueDentalPermissions.SystemAdministration.Default, StringComparison.Ordinal))
            .Where(p => !BlueDentalPermissionBridge.IsBridged(p.Policy))
            .Select(p => $"{p.Where} -> {p.Policy}")
            .Distinct()
            .ToList();

        unbridged.ShouldBeEmpty();
    }

    [Fact]
    public void Every_Bridge_Key_Should_Be_A_Legacy_Or_Abp_Permission()
    {
        var legacy = LegacyNames();
        BlueDentalPermissionBridge.Map.Keys
            .Where(k => !legacy.Contains(k))
            .Where(k => !k.StartsWith("AbpIdentity.", StringComparison.Ordinal))
            .ShouldBeEmpty();
    }

    [Fact]
    public void SystemAdministration_Users_Should_Not_Be_Bridged()
    {
        BlueDentalPermissionBridge.Map.Keys
            .Where(k => k.StartsWith(BlueDentalPermissions.SystemAdministration.Users.Default, StringComparison.Ordinal))
            .ShouldBeEmpty();
    }

    [Fact]
    public void Every_Bridge_Target_Should_Be_A_Defined_Ability()
    {
        var invalid = BlueDentalPermissionBridge.AllTargets()
            .Where(target =>
            {
                var parts = target.Split('.');
                return parts.Length != 3
                       || parts[0] != BlueDentalPermissions.GroupName
                       || !BlueDentalAbilities.Supports(parts[1], parts[2]);
            })
            .ToList();

        invalid.ShouldBeEmpty();
    }

    [Fact]
    public void Every_Bridge_Entry_Should_Have_At_Least_One_Target()
    {
        BlueDentalPermissionBridge.Map.Where(p => p.Value.Count == 0).Select(p => p.Key).ShouldBeEmpty();
    }

    /// <summary>The provider checks abilities through the same checker; a bridged ability would loop.</summary>
    [Fact]
    public void No_Ability_Name_Should_Be_Bridged()
    {
        BlueDentalAbilities.All()
            .Select(a => BlueDentalAbilities.Permission(a.Subject, a.Action))
            .Where(BlueDentalPermissionBridge.IsBridged)
            .ShouldBeEmpty();
    }

    [Theory]
    [InlineData("BlueDental.Organizations.View", "BlueDental.branchManager.read")]
    [InlineData("BlueDental.Catalogs.View", "BlueDental.catalogService.read")]
    [InlineData("BlueDental.Staff.Manage", "BlueDental.staff.update")]
    [InlineData("BlueDental.Finance.View", "BlueDental.reportIncome.read")]
    [InlineData("BlueDental.Timekeeping.View", "BlueDental.workSchedule.read")]
    [InlineData("BlueDental.Promotions.Manage", "BlueDental.voucher.create")]
    [InlineData("BlueDental.Inventory.View", "BlueDental.materials.read")]
    [InlineData("BlueDental.LaboOrders.View", "BlueDental.treatmentLabo.read")]
    public void Known_Pairs_Should_Be_Present(string legacy, string ability)
    {
        BlueDentalPermissionBridge.AbilitiesFor(legacy).ShouldContain(ability);
    }
}
