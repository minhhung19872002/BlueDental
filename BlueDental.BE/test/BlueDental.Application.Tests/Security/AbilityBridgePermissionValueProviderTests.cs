using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Claims;
using System.Threading.Tasks;
using BlueDental.Permissions;
using NSubstitute;
using Shouldly;
using Volo.Abp.Authorization.Permissions;
using Xunit;

namespace BlueDental.Application.Tests.Security;

/// <summary>
/// The bridge provider must grant a legacy name when any mapped ability is
/// granted, stay silent (Undefined) otherwise, and never touch the checker
/// for names it does not bridge.
/// </summary>
public class AbilityBridgePermissionValueProviderTests
{
    private const string Legacy = "BlueDental.Catalogs.View";
    private const string Ability = "BlueDental.catalogService.read";

    private readonly IPermissionChecker _checker = Substitute.For<IPermissionChecker>();
    private readonly IServiceProvider _services = Substitute.For<IServiceProvider>();
    private readonly AbilityBridgePermissionValueProvider _provider;
    private readonly ClaimsPrincipal _principal = new(new ClaimsIdentity([new Claim("sub", Guid.NewGuid().ToString())], "test"));

    public AbilityBridgePermissionValueProviderTests()
    {
        _services.GetService(typeof(IPermissionChecker)).Returns(_checker);
        _provider = new AbilityBridgePermissionValueProvider(Substitute.For<IPermissionStore>(), _services);
    }

    private void GrantAbilities(params string[] granted)
    {
        _checker.IsGrantedAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<string[]>())
            .Returns(call =>
            {
                var names = call.ArgAt<string[]>(1);
                var result = new MultiplePermissionGrantResult(names);
                foreach (var name in names.Where(granted.Contains))
                {
                    result.Result[name] = PermissionGrantResult.Granted;
                }
                return Task.FromResult(result);
            });
    }

    /// <summary>PermissionDefinition has no public constructor; build one through a group.</summary>
    private static PermissionDefinition Define(string name)
    {
        var ctor = typeof(PermissionGroupDefinition)
            .GetConstructors(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
            .OrderByDescending(c => c.GetParameters().Length)
            .First();
        var args = ctor.GetParameters()
            .Select(p => p.ParameterType == typeof(string) ? (object?)"BlueDental" : p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType) : null)
            .ToArray();
        var group = (PermissionGroupDefinition)ctor.Invoke(args);
        return group.AddPermission(name);
    }

    [Fact]
    public void Name_Should_Be_AB()
    {
        _provider.Name.ShouldBe("AB");
        AbilityBridgePermissionValueProvider.ProviderName.ShouldBe("AB");
    }

    [Fact]
    public async Task Bridged_Name_Should_Be_Granted_When_Any_Ability_Is_Granted()
    {
        GrantAbilities(Ability);

        var result = await _provider.CheckAsync(new PermissionValueCheckContext(Define(Legacy), _principal));

        result.ShouldBe(PermissionGrantResult.Granted);
    }

    [Fact]
    public async Task Bridged_Name_Should_Stay_Undefined_When_No_Ability_Is_Granted()
    {
        GrantAbilities();

        var result = await _provider.CheckAsync(new PermissionValueCheckContext(Define(Legacy), _principal));

        result.ShouldBe(PermissionGrantResult.Undefined);
    }

    [Fact]
    public async Task Unbridged_Name_Should_Stay_Undefined_Without_Consulting_The_Checker()
    {
        var result = await _provider.CheckAsync(
            new PermissionValueCheckContext(Define("BlueDental.SystemAdmin.Users"), _principal));

        result.ShouldBe(PermissionGrantResult.Undefined);
        _services.DidNotReceive().GetService(typeof(IPermissionChecker));
    }

    [Fact]
    public async Task Anonymous_Principal_Should_Stay_Undefined()
    {
        var result = await _provider.CheckAsync(new PermissionValueCheckContext(Define(Legacy), null));

        result.ShouldBe(PermissionGrantResult.Undefined);
        _services.DidNotReceive().GetService(typeof(IPermissionChecker));
    }

    [Fact]
    public async Task Batch_Should_Grant_Only_Names_With_A_Granted_Ability_In_One_Checker_Call()
    {
        GrantAbilities("BlueDental.staff.read");

        var definitions = new List<PermissionDefinition>
        {
            Define(Legacy),                       // catalog* — not granted
            Define("BlueDental.Staff.View"),      // staff.read — granted
            Define("BlueDental.SystemAdmin.Users"), // not bridged
        };

        var result = await _provider.CheckAsync(new PermissionValuesCheckContext(definitions, _principal));

        result.Result[Legacy].ShouldBe(PermissionGrantResult.Undefined);
        result.Result["BlueDental.Staff.View"].ShouldBe(PermissionGrantResult.Granted);
        result.Result["BlueDental.SystemAdmin.Users"].ShouldBe(PermissionGrantResult.Undefined);
        await _checker.Received(1).IsGrantedAsync(Arg.Any<ClaimsPrincipal>(), Arg.Any<string[]>());
    }

    [Fact]
    public async Task Batch_Without_Bridged_Names_Should_Not_Consult_The_Checker()
    {
        var definitions = new List<PermissionDefinition> { Define("BlueDental.SystemAdmin.Users") };

        var result = await _provider.CheckAsync(new PermissionValuesCheckContext(definitions, _principal));

        result.Result.Values.ShouldAllBe(v => v == PermissionGrantResult.Undefined);
        _services.DidNotReceive().GetService(typeof(IPermissionChecker));
    }
}
