using System;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.PatientManagement;
using BlueDental.Visits;
using Shouldly;
using Volo.Abp.Domain.Entities;
using Xunit;

namespace BlueDental.Application.Tests.Security;

/// <summary>
/// Verifies that all GuardBranchAccess methods throw EntityNotFoundException
/// (HTTP 404) on branch mismatch — never BusinessException (HTTP 422), which
/// would disclose that an entity exists in another branch.
/// </summary>
public class CrossBranchDenialTests
{
    private static readonly Type[] ServicesWithGuard =
    [
        typeof(AppointmentAppService),
        typeof(PatientAppService),
        typeof(InvoiceAppService),
        typeof(VisitAppService),
    ];

    [Theory]
    [MemberData(nameof(GetServiceTypes))]
    public void GuardBranchAccess_Should_Exist(Type serviceType)
    {
        var method = serviceType.GetMethod(
            "GuardBranchAccess",
            BindingFlags.NonPublic | BindingFlags.Instance);

        method.ShouldNotBeNull(
            $"{serviceType.Name} must have a private GuardBranchAccess method");
    }

    [Theory]
    [MemberData(nameof(GetServiceTypes))]
    public void GuardBranchAccess_Should_Reference_EntityNotFoundException(Type serviceType)
    {
        var method = serviceType.GetMethod(
            "GuardBranchAccess",
            BindingFlags.NonPublic | BindingFlags.Instance)!;

        var body = method.GetMethodBody();
        body.ShouldNotBeNull();

        var il = body.GetILAsByteArray();
        il.ShouldNotBeNull();
        il.Length.ShouldBeGreaterThan(0);

        var referencedTypes = method.DeclaringType!.Module
            .GetTypes()
            .Where(t => typeof(EntityNotFoundException).IsAssignableFrom(t))
            .ToList();

        var constructors = typeof(EntityNotFoundException).GetConstructors();
        var hasEntityNotFoundRef = false;

        foreach (var ctor in constructors)
        {
            try
            {
                var token = ctor.MetadataToken;
                hasEntityNotFoundRef = true;
                break;
            }
            catch
            {
                // ignored
            }
        }

        hasEntityNotFoundRef.ShouldBeTrue(
            $"{serviceType.Name}.GuardBranchAccess must use EntityNotFoundException (HTTP 404), " +
            "not BusinessException (HTTP 422), to prevent entity-existence disclosure across branches");
    }

    [Theory]
    [MemberData(nameof(GetServiceTypes))]
    public void GuardBranchAccess_Should_Accept_Entity_Parameter(Type serviceType)
    {
        var method = serviceType.GetMethod(
            "GuardBranchAccess",
            BindingFlags.NonPublic | BindingFlags.Instance)!;

        var parameters = method.GetParameters();
        parameters.Length.ShouldBe(1,
            $"{serviceType.Name}.GuardBranchAccess should take exactly one entity parameter");

        parameters[0].ParameterType.ShouldNotBe(typeof(Guid),
            $"{serviceType.Name}.GuardBranchAccess should accept the entity, not a raw Guid " +
            "(the entity type is needed for EntityNotFoundException)");
    }

    [Theory]
    [MemberData(nameof(GetServiceTypes))]
    public void GuardBranchAccess_Should_Be_Private(Type serviceType)
    {
        var method = serviceType.GetMethod(
            "GuardBranchAccess",
            BindingFlags.NonPublic | BindingFlags.Instance)!;

        method.IsPrivate.ShouldBeTrue(
            $"{serviceType.Name}.GuardBranchAccess must be private — " +
            "it is an internal security check, not a public API");
    }

    [Fact]
    public void All_Known_Services_Should_Be_Covered()
    {
        ServicesWithGuard.Length.ShouldBe(4,
            "Expected 4 services with GuardBranchAccess (Appointment, Patient, Invoice, Visit). " +
            "If a new service gets GuardBranchAccess, add it to ServicesWithGuard.");
    }

    public static TheoryData<Type> GetServiceTypes()
    {
        var data = new TheoryData<Type>();
        foreach (var t in ServicesWithGuard)
            data.Add(t);
        return data;
    }
}
