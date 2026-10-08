using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Staff;

/// <summary>Cụm 11 mục 1 — the work record of a staff member: what must hold together.</summary>
public class StaffEmploymentTests
{
    private static readonly DateOnly Today = new(2026, 10, 8);

    [Fact]
    public void Nothing_Filled_In_Is_Fine()
    {
        Should.NotThrow(() => StaffEmployment.EnsureValid(null, null, null, Today));
    }

    [Fact]
    public void A_Contract_May_End_On_Or_After_Its_Start()
    {
        Should.NotThrow(() => StaffEmployment.EnsureValid(Today, Today, null, Today));
        Should.NotThrow(() => StaffEmployment.EnsureValid(Today, Today.AddYears(1), null, Today));
        Should.NotThrow(() => StaffEmployment.EnsureValid(null, Today.AddYears(1), null, Today));
    }

    [Fact]
    public void A_Contract_Cannot_End_Before_It_Starts()
    {
        Should.Throw<BusinessException>(() => StaffEmployment.EnsureValid(Today, Today.AddDays(-1), null, Today))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Staff.ContractEndsBeforeStart);
    }

    [Fact]
    public void A_Certificate_Cannot_Be_Issued_In_The_Future()
    {
        Should.NotThrow(() => StaffEmployment.EnsureValid(null, null, Today, Today));
        Should.Throw<BusinessException>(() => StaffEmployment.EnsureValid(null, null, Today.AddDays(1), Today))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Staff.CertificateIssuedInFuture);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("   ", null)]
    [InlineData("  Bác sĩ trưởng  ", "Bác sĩ trưởng")]
    public void Text_Is_Trimmed_And_Blank_Is_Nothing(string? input, string? expected)
    {
        StaffEmployment.Clean(input).ShouldBe(expected);
    }
}
