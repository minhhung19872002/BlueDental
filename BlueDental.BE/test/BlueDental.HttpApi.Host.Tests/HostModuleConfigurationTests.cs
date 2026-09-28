using System;
using System.Linq;
using System.Reflection;
using BlueDental.Account;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.AspNetCore.Mvc;
using Volo.Abp.AspNetCore.Uow;
using Volo.Abp.Modularity;
using Xunit;

namespace BlueDental.HttpApi.Host.Tests;

/// <summary>
/// The host must not expose the Application assembly as conventional (auto
/// API) controllers. Doing so made ABP treat every application service as a
/// controller type and skip its dynamic proxy, so the [Authorize] attributes
/// on the services were never enforced behind the hand-written controllers.
/// </summary>
public class HostModuleConfigurationTests
{
    [Fact]
    public void Host_Should_Not_Register_Conventional_Controllers()
    {
        var services = new ServiceCollection();
        var context = new ServiceConfigurationContext(services);
        var module = new BlueDentalHttpApiHostModule();
        typeof(AbpModule)
            .GetProperty(nameof(ServiceConfigurationContext), BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)!
            .SetValue(module, context);

        module.PreConfigureServices(context);

        var options = services.ExecutePreConfiguredActions<AbpAspNetCoreMvcOptions>();
        options.ConventionalControllers.ConventionalControllerSettings.ShouldBeEmpty();
    }

    /// <summary>
    /// Without auto API controllers, a service is reachable only through a
    /// controller that takes it in its constructor. A contract that is meant
    /// to stay internal says so with [RemoteService(IsEnabled = false)].
    /// </summary>
    [Fact]
    public void Every_Application_Service_Contract_Should_Be_Served_By_A_Controller()
    {
        var contracts = typeof(IAccountAppService).Assembly
            .GetTypes()
            .Where(t => t.IsInterface && t.IsPublic && !t.IsGenericTypeDefinition)
            .Where(t => typeof(IApplicationService).IsAssignableFrom(t) && t != typeof(IApplicationService))
            .Where(t => !RemoteServiceAttribute.IsExplicitlyDisabledFor(t))
            .ToList();

        var served = typeof(BlueDentalController).Assembly
            .GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t))
            .SelectMany(t => t.GetConstructors())
            .SelectMany(c => c.GetParameters())
            .Select(p => p.ParameterType)
            .ToHashSet();

        contracts.Where(c => !served.Contains(c)).Select(c => c.Name).ShouldBeEmpty();
    }

    /// <summary>
    /// R-606: under <c>UseUnitOfWork()</c> an API write committed only after its
    /// response had gone out, on the request's abort token, so a client that
    /// left on the 200 rolled the write back. /api stays outside that
    /// middleware, which leaves ABP's action filter to commit before the result
    /// is written.
    /// </summary>
    [Fact]
    public void Api_Requests_Commit_Before_Their_Response_Is_Written()
    {
        var services = new ServiceCollection().AddOptions();
        var context = new ServiceConfigurationContext(services);
        var module = new BlueDentalHttpApiHostModule();
        typeof(AbpModule)
            .GetProperty(nameof(ServiceConfigurationContext), BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)!
            .SetValue(module, context);

        var configure = typeof(BlueDentalHttpApiHostModule)
            .GetMethod("ConfigureUnitOfWork", BindingFlags.Instance | BindingFlags.NonPublic);
        configure.ShouldNotBeNull("the host no longer configures its unit of work");
        configure.Invoke(module, null);

        var options = services.BuildServiceProvider()
            .GetRequiredService<IOptions<AbpAspNetCoreUnitOfWorkOptions>>()
            .Value;
        options.IgnoredUrls.ShouldContain("/api");
    }
}
