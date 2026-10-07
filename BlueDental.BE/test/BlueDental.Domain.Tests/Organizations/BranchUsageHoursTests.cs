using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Organizations;

/// <summary>
/// Cụm 11 mục 13 — Quản lý thời gian sử dụng: a branch's "Giờ được phép sử
/// dụng" window and whether an account may sign in at a clinic time.
/// </summary>
public class BranchUsageHoursTests
{
    private static ClinicBranch Branch(string? start = null, string? end = null) =>
        new ClinicBranch(Guid.NewGuid(), $"CN{Guid.NewGuid():N}"[..8], "Chi nhánh")
            .SetUsageHours(start is null ? null : TimeOnly.Parse(start), end is null ? null : TimeOnly.Parse(end));

    private static TimeOnly At(string time) => TimeOnly.Parse(time);

    [Theory]
    [InlineData("06:00", true)]
    [InlineData("12:30", true)]
    [InlineData("19:59", true)]
    [InlineData("20:00", false)]
    [InlineData("05:59", false)]
    [InlineData("23:00", false)]
    public void A_Day_Window_Includes_Its_Start_And_Excludes_Its_End(string time, bool expected)
    {
        Branch("06:00", "20:00").AllowsUsageAt(At(time)).ShouldBe(expected);
    }

    [Theory]
    [InlineData("22:00", true)]
    [InlineData("23:59", true)]
    [InlineData("00:00", true)]
    [InlineData("05:59", true)]
    [InlineData("06:00", false)]
    [InlineData("12:00", false)]
    public void An_End_Before_The_Start_Spans_Midnight(string time, bool expected)
    {
        Branch("22:00", "06:00").AllowsUsageAt(At(time)).ShouldBe(expected);
    }

    [Fact]
    public void No_Window_Means_No_Restriction()
    {
        var branch = Branch();

        branch.RestrictsUsageHours.ShouldBeFalse();
        branch.UsageHoursText.ShouldBeNull();
        branch.AllowsUsageAt(At("03:00")).ShouldBeTrue();
    }

    [Fact]
    public void The_Window_Reads_As_Hours()
    {
        Branch("06:00", "20:00").UsageHoursText.ShouldBe("06:00–20:00");
    }

    [Theory]
    [InlineData("06:00", null)]
    [InlineData(null, "20:00")]
    [InlineData("08:00", "08:00")]
    public void Half_A_Window_Or_An_Empty_One_Is_Refused(string? start, string? end)
    {
        Should.Throw<BusinessException>(() => Branch(start, end))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Organizations.InvalidUsageHours);
    }

    [Fact]
    public void Clearing_The_Window_Lifts_The_Restriction()
    {
        var branch = Branch("06:00", "20:00").SetUsageHours(null, null);

        branch.RestrictsUsageHours.ShouldBeFalse();
    }

    [Fact]
    public void Branches_Without_A_Window_Restrict_Nobody()
    {
        UsageHoursPolicy.IsAllowed(false, [Branch(), Branch()], At("03:00")).ShouldBeTrue();
        UsageHoursPolicy.IsAllowed(false, [], At("03:00")).ShouldBeTrue();
    }

    [Fact]
    public void Any_Of_The_Accounts_Windows_Will_Do()
    {
        var branches = new[] { Branch("06:00", "12:00"), Branch("13:00", "20:00"), Branch() };

        UsageHoursPolicy.IsAllowed(false, branches, At("07:00")).ShouldBeTrue();
        UsageHoursPolicy.IsAllowed(false, branches, At("15:00")).ShouldBeTrue();
        UsageHoursPolicy.IsAllowed(false, branches, At("12:30")).ShouldBeFalse();
        UsageHoursPolicy.Describe(branches).ShouldBe("06:00–12:00, 13:00–20:00");
    }

    [Fact]
    public void An_Exempt_Account_Works_At_Any_Hour()
    {
        UsageHoursPolicy.IsAllowed(true, [Branch("06:00", "20:00")], At("23:00")).ShouldBeTrue();
    }
}
