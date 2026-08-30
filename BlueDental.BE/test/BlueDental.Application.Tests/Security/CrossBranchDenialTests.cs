using System;
using System.Linq;
using System.Reflection;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.CustomerCare;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;

using Shouldly;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Xunit;

namespace BlueDental.Application.Tests.Security;

public class CrossBranchDenialTests
{
    private static readonly Type[] ServicesWithGuard =
    [
        typeof(AppointmentAppService),
        typeof(PatientAppService),
        typeof(InvoiceAppService),

        typeof(InsuranceClaimAppService),
        typeof(TreatmentPlanAppService),
        typeof(CustomerCareAppService),
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
    public void GuardBranchAccess_Should_Throw_EntityNotFoundException_Not_BusinessException(Type serviceType)
    {
        var method = serviceType.GetMethod(
            "GuardBranchAccess",
            BindingFlags.NonPublic | BindingFlags.Instance)!;

        var body = method.GetMethodBody();
        body.ShouldNotBeNull();

        var il = body.GetILAsByteArray()!;
        var module = method.Module;

        var referencedCtorTypes = new System.Collections.Generic.List<Type>();

        for (var i = 0; i < il.Length; i++)
        {
            if (il[i] != 0x73) continue; // OpCodes.Newobj = 0x73

            if (i + 4 >= il.Length) continue;
            var token = BitConverter.ToInt32(il, i + 1);

            try
            {
                var member = module.ResolveMember(token);
                if (member is ConstructorInfo ctor)
                    referencedCtorTypes.Add(ctor.DeclaringType!);
            }
            catch { }
        }

        referencedCtorTypes.ShouldContain(
            t => typeof(EntityNotFoundException).IsAssignableFrom(t),
            $"{serviceType.Name}.GuardBranchAccess must construct EntityNotFoundException (HTTP 404)");

        referencedCtorTypes.ShouldNotContain(
            t => typeof(BusinessException).IsAssignableFrom(t),
            $"{serviceType.Name}.GuardBranchAccess must NOT construct BusinessException (HTTP 422) — " +
            "that discloses entity existence across branches");
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
        ServicesWithGuard.Length.ShouldBe(7,
            "Expected 7 services with GuardBranchAccess. " +
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
