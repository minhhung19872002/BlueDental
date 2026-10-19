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
/// Bộ hồ sơ bệnh án asks for the same rights as the sheets in it: opening a set
/// adds to the record, changing its slips edits it, cancelling it stands where
/// deleting would.
/// </summary>
public class MedicalRecordSetAppServiceContractTests
{
    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IMedicalRecordSetAppService).IsAssignableFrom(typeof(MedicalRecordSetAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(MedicalRecordSetAppService)).ShouldBeTrue();
    }

    [Fact]
    public void No_Public_Method_Outside_The_Interface()
    {
        typeof(MedicalRecordSetAppService)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Select(m => m.Name)
            .Distinct()
            .ShouldBeSubsetOf(typeof(IMedicalRecordSetAppService).GetMethods().Select(m => m.Name));
    }

    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    [InlineData("GetPlansAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    [InlineData("UpdateAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    [InlineData("CancelAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    [InlineData("GetSheetFactsAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public void Each_Method_Names_Its_Leaf(string method, string permission)
    {
        typeof(MedicalRecordSetAppService).GetMethods().Single(m => m.Name == method)
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }
}
