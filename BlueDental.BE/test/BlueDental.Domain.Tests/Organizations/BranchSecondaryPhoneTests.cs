using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Organizations;

/// <summary>
/// R-1335 — "Số điện thoại 2" of Thông tin phòng khám: the clinic's second line,
/// printed after the first on every letterhead.
/// </summary>
public class BranchSecondaryPhoneTests
{
    private static ClinicBranch Branch() =>
        new(Guid.NewGuid(), $"CN{Guid.NewGuid():N}"[..8], "Chi nhánh", phoneNumber: "0779160888");

    [Theory]
    [InlineData("0767080333", "0767080333")]
    [InlineData(" 0767080333 ", "0767080333")]
    [InlineData("02838123456", "02838123456")]
    public void A_Phone_Number_Is_Kept_Trimmed(string typed, string kept)
    {
        var branch = Branch().SetSecondaryPhoneNumber(typed);

        branch.SecondaryPhoneNumber.ShouldBe(kept);
        branch.PhoneNumber.ShouldBe("0779160888");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_Clears_It(string? typed)
    {
        var branch = Branch().SetSecondaryPhoneNumber("0767080333");

        branch.SetSecondaryPhoneNumber(typed);

        branch.SecondaryPhoneNumber.ShouldBeNull();
    }

    [Theory]
    [InlineData("767080333")]
    [InlineData("0767 080 333")]
    [InlineData("0779160888 - 0767080333")]
    [InlineData("abc")]
    [InlineData("076708033")]
    [InlineData("076708033312")]
    public void Anything_Else_Is_Refused_And_Nothing_Changes(string typed)
    {
        var branch = Branch().SetSecondaryPhoneNumber("0767080333");

        var error = Should.Throw<BusinessException>(() => branch.SetSecondaryPhoneNumber(typed));

        error.Code.ShouldBe(BlueDentalDomainErrorCodes.Organizations.InvalidSecondaryPhone);
        branch.SecondaryPhoneNumber.ShouldBe("0767080333");
    }
}
