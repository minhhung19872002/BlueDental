using System;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using Volo.Abp;
using Xunit;
#pragma warning disable CS8019

namespace BlueDental.Domain.Tests.PatientManagement;

public class PatientTests
{
    private static ContactInfo ValidContact => new("0901234567", "test@example.com", null);

    [Fact]
    public void Register_Should_Set_Active_Status()
    {
        var patient = Patient.Register(
            Guid.NewGuid(), "BN2026001",
            "An", "Nguyễn Văn",
            new DateOnly(1990, 1, 1), Gender.Male,
            ValidContact, Guid.NewGuid());

        Assert.Equal(PatientStatus.Active, patient.Status);
        Assert.Equal("An", patient.FirstName);
        Assert.Equal("BN2026001", patient.PatientCode);
    }

    [Fact]
    public void Register_Should_Throw_When_FirstName_Empty()
    {
        Assert.Throws<ArgumentException>(() =>
            Patient.Register(
                Guid.NewGuid(), "BN2026002",
                "", "Nguyễn",
                new DateOnly(1990, 1, 1), Gender.Female,
                ValidContact, Guid.NewGuid()));
    }

    [Fact]
    public void Register_Should_Throw_When_DOB_In_Future()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

        Assert.Throws<BusinessException>(() =>
            Patient.Register(
                Guid.NewGuid(), "BN2026003",
                "Bình", "Trần",
                futureDate, Gender.Male,
                ValidContact, Guid.NewGuid()));
    }

    [Fact]
    public void Deactivate_Should_Set_Inactive_Status()
    {
        var patient = Patient.Register(
            Guid.NewGuid(), "BN2026004",
            "Mai", "Trần Thị",
            new DateOnly(1985, 6, 15), Gender.Female,
            ValidContact, Guid.NewGuid());

        patient.Deactivate();
        Assert.Equal(PatientStatus.Inactive, patient.Status);
    }

    [Fact]
    public void FullName_Should_Combine_First_And_Last()
    {
        var patient = Patient.Register(
            Guid.NewGuid(), "BN2026005",
            "An", "Nguyễn Văn",
            new DateOnly(1995, 3, 10), Gender.Male,
            ValidContact, Guid.NewGuid());

        Assert.Equal("An Nguyễn Văn", patient.FullName);
    }
}
