using System;
using Shouldly;
using Xunit;

namespace BlueDental.Organizations;

/// <summary>
/// R-1300 — the branch's second phone line, printed after the first on the
/// prescription letterhead ("0799.160.888 – 0767.080.333").
/// </summary>
public class BranchSecondPhoneTests
{
    private static ClinicBranch Branch() =>
        new(Guid.NewGuid(), $"CN{Guid.NewGuid():N}"[..8], "Chi nhánh");

    [Fact]
    public void A_Second_Phone_Is_Kept_Trimmed()
    {
        Branch().SetSecondPhone("  0767080333 ").PhoneNumber2.ShouldBe("0767080333");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_Blank_Second_Phone_Clears_It(string? blank)
    {
        Branch().SetSecondPhone("0767080333").SetSecondPhone(blank).PhoneNumber2.ShouldBeNull();
    }
}
