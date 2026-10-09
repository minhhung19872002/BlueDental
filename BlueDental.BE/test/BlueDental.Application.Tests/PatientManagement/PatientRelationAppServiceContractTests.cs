using System;
using System.Linq;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.PatientManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.PatientManagement;

/// <summary>
/// Mối quan hệ reads and writes with the patient leaves (it is part of the
/// record); Hồ sơ nhóm has its own patientGroup subject.
/// </summary>
public class PatientRelationAppServiceContractTests
{
    [Fact]
    public void Services_Implement_Their_Interfaces()
    {
        typeof(IPatientRelationshipAppService).IsAssignableFrom(typeof(PatientRelationshipAppService)).ShouldBeTrue();
        typeof(IPatientGroupAppService).IsAssignableFrom(typeof(PatientGroupAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(PatientRelationshipAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(PatientGroupAppService)).ShouldBeTrue();
    }

    [Fact]
    public void No_Public_Method_Outside_The_Interfaces()
    {
        foreach (var (service, contract) in new[]
                 {
                     (typeof(PatientRelationshipAppService), typeof(IPatientRelationshipAppService)),
                     (typeof(PatientGroupAppService), typeof(IPatientGroupAppService)),
                 })
        {
            var exposed = service.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Select(m => m.Name).Distinct();
            exposed.ShouldBeSubsetOf(contract.GetMethods().Select(m => m.Name));
        }
    }

    [Theory]
    [InlineData(typeof(PatientRelationshipAppService), "GetListAsync", BlueDentalAbilityPermissions.Patient.Read)]
    [InlineData(typeof(PatientRelationshipAppService), "GetFamilyAsync", BlueDentalAbilityPermissions.Patient.Read)]
    [InlineData(typeof(PatientRelationshipAppService), "CreateAsync", BlueDentalAbilityPermissions.Patient.Update)]
    [InlineData(typeof(PatientRelationshipAppService), "UpdateAsync", BlueDentalAbilityPermissions.Patient.Update)]
    [InlineData(typeof(PatientRelationshipAppService), "DeleteAsync", BlueDentalAbilityPermissions.Patient.Update)]
    [InlineData(typeof(PatientGroupAppService), "GetListAsync", BlueDentalAbilityPermissions.PatientGroup.Read)]
    [InlineData(typeof(PatientGroupAppService), "GetAsync", BlueDentalAbilityPermissions.PatientGroup.Read)]
    [InlineData(typeof(PatientGroupAppService), "GetByPatientAsync", BlueDentalAbilityPermissions.PatientGroup.Read)]
    [InlineData(typeof(PatientGroupAppService), "CreateAsync", BlueDentalAbilityPermissions.PatientGroup.Create)]
    [InlineData(typeof(PatientGroupAppService), "UpdateAsync", BlueDentalAbilityPermissions.PatientGroup.Update)]
    [InlineData(typeof(PatientGroupAppService), "DeleteAsync", BlueDentalAbilityPermissions.PatientGroup.Delete)]
    public void Each_Method_Names_Its_Leaf(Type service, string method, string permission)
    {
        service.GetMethods().Single(m => m.Name == method)
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }
}
