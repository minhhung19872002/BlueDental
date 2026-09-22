using System;
using System.Collections.Generic;
using System.Linq;
using Autofac;
using Autofac.Core;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Authorization;
using Volo.Abp.Autofac;
using Volo.Abp.DynamicProxy;
using Xunit;

namespace BlueDental.Application.Tests.Permissions;

/// <summary>
/// ABP enforces the [Authorize] attributes on an application service through
/// a Castle interceptor that Autofac wraps around the registration. A service
/// that is also registered as a conventional (auto API) controller is left
/// out of that wrapping, and its attributes then mean nothing when a
/// hand-written controller calls it through the interface.
///
/// The container is built the way the host builds it, but never initialized:
/// the registrations are enough, and initializing would need the real
/// infrastructure.
/// </summary>
public class ApplicationServiceInterceptionTests
{
    private const string InterceptorsMetadataKey =
        "Autofac.Extras.DynamicProxy.RegistrationExtensions.InterceptorsPropertyName";

    [Theory]
    [InlineData(typeof(IDentalProcedureAppService))]
    [InlineData(typeof(IPatientAppService))]
    [InlineData(typeof(IClinicBranchAppService))]
    public void Application_Services_Should_Sit_Behind_The_Authorization_Interceptor(Type serviceType)
    {
        using var application = AbpApplicationFactory.Create<BlueDentalApplicationModule>(options => options.UseAutofac());
        using var provider = (IDisposable)application.Services.BuildServiceProviderFromFactory();
        var scope = ((IServiceProvider)provider).GetRequiredService<ILifetimeScope>();

        var registrations = scope.ComponentRegistry.RegistrationsFor(new TypedService(serviceType)).ToList();

        registrations.ShouldNotBeEmpty();
        foreach (var registration in registrations)
        {
            DynamicProxyIgnoreTypes.Contains(registration.Activator.LimitType).ShouldBeFalse(
                $"{registration.Activator.LimitType.Name} is excluded from dynamic proxying");

            registration.Metadata.TryGetValue(InterceptorsMetadataKey, out var value).ShouldBeTrue(
                $"{registration.Activator.LimitType.Name} has no interceptors");

            var interceptors = ((IEnumerable<Service>)value!)
                .OfType<TypedService>()
                .Select(s => s.ServiceType)
                .ToList();

            interceptors.ShouldContain(t =>
                t.IsGenericType && t.GetGenericArguments()[0] == typeof(AuthorizationInterceptor));
        }
    }
}
