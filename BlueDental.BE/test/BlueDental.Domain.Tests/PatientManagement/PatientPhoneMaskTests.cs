using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.PatientManagement;

/// <summary>
/// Cụm 11 mục 9 — "Ẩn số điện thoại": how a phone is shown masked, and how a
/// masked value coming back in an edit is told from a real number.
/// </summary>
public class PatientPhoneMaskTests
{
    [Theory]
    [InlineData("0901234567", "090****567")]
    [InlineData("02887654321", "028*****321")]
    [InlineData("84901234567", "849*****567")]
    [InlineData("1234567", "123*567")]
    [InlineData("123456", "****56")]
    [InlineData("12", "12")]
    public void Keeps_The_First_And_Last_Three(string phone, string masked)
    {
        PatientPhoneMask.Mask(phone).ShouldBe(masked);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("090****567")]
    public void Nothing_Or_An_Already_Masked_Value_Stays_As_It_Is(string? value)
    {
        PatientPhoneMask.Mask(value).ShouldBe(value);
    }

    [Fact]
    public void Free_Text_Has_Every_Phone_In_It_Masked()
    {
        PatientPhoneMask.MaskEmbedded("phone=0901234567; code=12; zalo 84912345678")
            .ShouldBe("phone=090****567; code=12; zalo 849*****678");
    }

    [Fact]
    public void A_Typed_Number_Is_Taken_As_Typed()
    {
        PatientPhoneMask.Resolve("0911222333", "0901234567").ShouldBe("0911222333");
        PatientPhoneMask.Resolve(null, "0901234567").ShouldBeNull();
    }

    [Fact]
    public void A_Masked_Value_Stands_For_The_Known_Number_It_Masks()
    {
        PatientPhoneMask.Resolve("090****567", null, "0911222333", "0901234567").ShouldBe("0901234567");
        PatientPhoneMask.Resolve(" 090****567 ", "0901234567", "0901234567").ShouldBe("0901234567");
    }

    [Theory]
    [InlineData("090****567")]
    [InlineData("090****999")]
    public void A_Masked_Value_Nothing_Known_Fits_Is_Refused(string incoming)
    {
        Should.Throw<BusinessException>(() => PatientPhoneMask.Resolve(incoming, "0911222333"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MaskedPhoneUnresolved);
        Should.Throw<BusinessException>(() => PatientPhoneMask.Resolve(incoming));
    }

    [Fact]
    public void Two_Known_Numbers_With_The_Same_Mask_Are_Refused_Rather_Than_Guessed()
    {
        Should.Throw<BusinessException>(() => PatientPhoneMask.Resolve("090****567", "0901234567", "0909999567"));
    }
}
