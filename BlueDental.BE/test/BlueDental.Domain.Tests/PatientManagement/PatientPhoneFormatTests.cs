using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.PatientManagement;

/// <summary>
/// Mã vùng on the phone field (2026-10-14): a Vietnamese number stays national
/// with its 0, a foreign one is stored E.164, and one spelling per number.
/// </summary>
public class PatientPhoneFormatTests
{
    [Theory]
    [InlineData("0901234567", "0901234567")]
    [InlineData(" 090 123 4567 ", "0901234567")]
    [InlineData("090.123-4567", "0901234567")]
    [InlineData("+84901234567", "0901234567")]
    [InlineData("+84 0901234567", "0901234567")]
    [InlineData("0084901234567", "0901234567")]
    [InlineData("+1 (415) 555-0123", "+14155550123")]
    [InlineData("0014155550123", "+14155550123")]
    [InlineData("+82 10-1234-5678", "+821012345678")]
    public void Spellings_Of_One_Number_Become_One(string typed, string stored)
    {
        PatientPhoneFormat.Normalize(typed).ShouldBe(stored);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "")]
    [InlineData("   ", "")]
    public void Nothing_Stays_Nothing(string? typed, string? stored)
    {
        PatientPhoneFormat.Normalize(typed).ShouldBe(stored);
    }

    [Theory]
    [InlineData("0901234567")]
    [InlineData("02887654321")]
    [InlineData("12345678")]
    [InlineData("+14155550123")]
    [InlineData("+6591234567")]
    [InlineData("+123456789012345")]
    public void National_And_International_Numbers_Are_Valid(string phone)
    {
        PatientPhoneFormat.IsValid(phone).ShouldBeTrue();
    }

    [Theory]
    [InlineData("1234567")]
    [InlineData("1234567890123456")]
    [InlineData("+0123456789")]
    [InlineData("+12345")]
    [InlineData("+1234567890123456")]
    [InlineData("090abc4567")]
    [InlineData("090****567")]
    public void Anything_Else_Is_Not(string phone)
    {
        PatientPhoneFormat.IsValid(phone).ShouldBeFalse();
    }

    [Fact]
    public void Prepare_Stores_The_Normalized_Number()
    {
        PatientPhoneFormat.Prepare("+84 912 345 678").ShouldBe("0912345678");
        PatientPhoneFormat.Prepare("+44 20 7946 0958").ShouldBe("+442079460958");
        PatientPhoneFormat.Prepare(null).ShouldBeNull();
    }

    [Fact]
    public void Prepare_Refuses_A_New_Value_That_Is_Not_A_Phone()
    {
        Should.Throw<BusinessException>(() => PatientPhoneFormat.Prepare("12-34"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.InvalidPhone);
        Should.Throw<BusinessException>(() => PatientPhoneFormat.Prepare("+0912345678", "0901234567"));
    }

    [Fact]
    public void Prepare_Keeps_A_Number_Already_On_File_Even_From_Before_The_Rule()
    {
        PatientPhoneFormat.Prepare("1234", null, "1234").ShouldBe("1234");
        PatientPhoneFormat.Prepare(" 1234 ", "1234").ShouldBe("1234");
    }
}
