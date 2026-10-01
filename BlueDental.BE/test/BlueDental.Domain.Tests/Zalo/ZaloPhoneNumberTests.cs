using BlueDental.Zalo;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class ZaloPhoneNumberTests
{
    [Theory]
    [InlineData("0912345678", "84912345678")]
    [InlineData("84912345678", "84912345678")]
    [InlineData("+84 912 345 678", "84912345678")]
    [InlineData("840912345678", "84912345678")]
    [InlineData("091-234-5678", "84912345678")]
    public void Normalizes_vietnamese_numbers_to_zalo_format(string raw, string expected)
    {
        ZaloPhoneNumber.Normalize(raw).ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("091234567")]
    [InlineData("09123456789")]
    [InlineData("1912345678")]
    public void Rejects_numbers_that_are_not_a_vietnamese_mobile(string? raw)
    {
        var ex = Should.Throw<BusinessException>(() => ZaloPhoneNumber.Normalize(raw));
        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.ZaloInvalidPhone);
    }

    [Fact]
    public void Turns_the_zalo_form_back_into_the_local_form_for_display()
    {
        ZaloPhoneNumber.ToLocal("84912345678").ShouldBe("0912345678");
    }
}
