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
    [InlineData("GetPhonesAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    // Offered only to someone who may write on a sheet (R-1219).
    [InlineData("GetFieldSuggestionsAsync", BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
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

    [Fact]
    public void Only_The_Listed_Blanks_Offer_Suggestions()
    {
        var groups = MedicalRecordFieldSuggestions.GroupsOf(MedicalRecordForm.OutpatientDental);
        groups.Select(g => g.Field).ShouldBe(["outpatient-dental.text.30", "outpatient-dental.text.43"]);
        groups[0].Lines.ShouldBe([.. Enumerable.Range(30, 6).Select(n => $"outpatient-dental.text.{n}")]);
        groups[1].Lines.ShouldBe(["outpatient-dental.text.43", "outpatient-dental.text.44"]);
        MedicalRecordFieldSuggestions.GroupsOf(MedicalRecordForm.Cover).ShouldBeEmpty();
        MedicalRecordFieldSuggestions.MinPatients.ShouldBe(2);
    }
}
