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
/// Bệnh án, including the drawings a sheet links to: storing one is writing on
/// the sheet, reading one is reading the sheet.
/// </summary>
public class PatientMedicalRecordAppServiceContractTests
{
    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IPatientMedicalRecordAppService).IsAssignableFrom(typeof(PatientMedicalRecordAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(PatientMedicalRecordAppService)).ShouldBeTrue();
    }

    [Fact]
    public void No_Public_Method_Outside_The_Interface()
    {
        typeof(PatientMedicalRecordAppService)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Select(m => m.Name)
            .Distinct()
            .ShouldBeSubsetOf(typeof(IPatientMedicalRecordAppService).GetMethods().Select(m => m.Name));
    }

    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    [InlineData("GetAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    [InlineData("UpdateAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    [InlineData("CancelAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    [InlineData("UploadDrawingAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    [InlineData("GetDrawingAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public void Each_Method_Names_Its_Leaf(string method, string permission)
    {
        typeof(PatientMedicalRecordAppService).GetMethods().Single(m => m.Name == method)
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }
}
