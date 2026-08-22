using System;
using System.Linq;
using System.Reflection;
using BlueDental.Permissions;
using Xunit;

namespace BlueDental.Domain.Tests.Permissions;

/// <summary>
/// The constants in <see cref="BlueDentalAbilityPermissions"/> are generated
/// from the same observation as <see cref="BlueDentalAbilities"/>. These tests
/// keep the two from drifting apart.
/// </summary>
public class BlueDentalAbilityPermissionsTests
{
    private static Type[] SubjectClasses =>
        typeof(BlueDentalAbilityPermissions)
            .GetNestedTypes(BindingFlags.Public | BindingFlags.Static);

    private static string[] PermissionConstants(Type subjectClass) =>
        subjectClass
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.Name != nameof(BlueDentalAbilities.Subjects))
            .Select(f => (string)f.GetRawConstantValue()!)
            .Where(value => value.StartsWith("BlueDental."))
            .ToArray();

    [Fact]
    public void Should_Expose_One_Class_Per_Subject()
    {
        Assert.Equal(BlueDentalAbilities.Catalog.Count, SubjectClasses.Length);
    }

    [Fact]
    public void Every_Constant_Should_Match_A_Catalog_Ability()
    {
        var expected = BlueDentalAbilities
            .All()
            .Select(pair => BlueDentalAbilities.Permission(pair.Subject, pair.Action))
            .OrderBy(x => x)
            .ToList();

        var actual = SubjectClasses
            .SelectMany(PermissionConstants)
            .OrderBy(x => x)
            .ToList();

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Every_Subject_Class_Should_Carry_Its_Subject_Name()
    {
        foreach (var subjectClass in SubjectClasses)
        {
            var subject = (string)subjectClass
                .GetField("Subject", BindingFlags.Public | BindingFlags.Static)!
                .GetRawConstantValue()!;

            Assert.True(
                BlueDentalAbilities.Catalog.ContainsKey(subject),
                $"{subjectClass.Name}.Subject = '{subject}' is not in the catalog.");
        }
    }

    [Fact]
    public void Known_Constants_Should_Have_The_Expected_Value()
    {
        Assert.Equal("BlueDental.patient.read", BlueDentalAbilityPermissions.Patient.Read);
        Assert.Equal("BlueDental.patient.hidePhone", BlueDentalAbilityPermissions.Patient.HidePhone);
        Assert.Equal("BlueDental.payment.finalize", BlueDentalAbilityPermissions.Payment.Finalize);
        Assert.Equal("BlueDental.reportTransfer.transfer", BlueDentalAbilityPermissions.ReportTransfer.Transfer);
        Assert.Equal("BlueDental.workSchedule.attendanceOthers", BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers);
    }
}
