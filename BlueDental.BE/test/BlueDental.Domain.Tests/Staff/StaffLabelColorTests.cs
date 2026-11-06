using System;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Identity;
using Xunit;

namespace BlueDental.Staff;

/// <summary>
/// Màu nhãn on a staff member (R-1155): "#RRGGBB" or nothing, which the
/// doctor badges read as the staff default #FF007F.
/// </summary>
public class StaffLabelColorTests
{
    private static IdentityUser User() => new(Guid.NewGuid(), "bs.a", "bs.a@bluedental.local");

    [Fact]
    public void A_New_Staff_Member_Has_No_Colour()
    {
        StaffLabelColor.Read(User()).ShouldBeNull();
    }

    [Fact]
    public void A_Hex_Colour_Is_Stored_Upper_Case()
    {
        var user = User();

        StaffLabelColor.Write(user, "#2671d8");

        StaffLabelColor.Read(user).ShouldBe("#2671D8");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_Blank_Colour_Clears_It_Back_To_The_Default(string? blank)
    {
        var user = User();
        StaffLabelColor.Write(user, "#10B981");

        StaffLabelColor.Write(user, blank);

        StaffLabelColor.Read(user).ShouldBeNull();
    }

    [Theory]
    [InlineData("red")]
    [InlineData("#FFF")]
    [InlineData("2671D8")]
    [InlineData("#2671D8FF")]
    [InlineData("#GGGGGG")]
    public void Anything_But_RRGGBB_Is_Refused(string color)
    {
        var user = User();
        StaffLabelColor.Write(user, "#10B981");

        var error = Should.Throw<BusinessException>(() => StaffLabelColor.Write(user, color));

        error.Code.ShouldBe(BlueDentalDomainErrorCodes.Staff.InvalidLabelColor);
        StaffLabelColor.Read(user).ShouldBe("#10B981");
    }
}
