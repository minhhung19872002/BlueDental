using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Organizations;

/// <summary>
/// Lịch nghỉ (BA 2026-11-14): the most days off a person may register in a
/// month at a branch — 4 unless admin sets another whole number up to 31.
/// </summary>
public class BranchDayOffLimitTests
{
    private static ClinicBranch Branch() => new(Guid.NewGuid(), $"CN{Guid.NewGuid():N}"[..8], "Chi nhánh");

    [Fact]
    public void A_New_Branch_Allows_Four_Days_Off()
    {
        Branch().MaxDayOffDays.ShouldBe(4);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(6)]
    [InlineData(31)]
    public void Admin_Sets_Any_Whole_Number_From_1_To_31(int days)
    {
        Branch().SetMaxDayOffDays(days).MaxDayOffDays.ShouldBe(days);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(32)]
    public void Anything_Else_Is_Refused(int days)
    {
        var branch = Branch();

        var error = Should.Throw<BusinessException>(() => branch.SetMaxDayOffDays(days));

        error.Code.ShouldBe(BlueDentalDomainErrorCodes.Organizations.InvalidMaxDayOffDays);
        branch.MaxDayOffDays.ShouldBe(4);
    }
}
