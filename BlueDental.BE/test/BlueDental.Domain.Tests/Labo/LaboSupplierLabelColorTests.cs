using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Labo;

/// <summary>
/// Màu nhãn on Nhà cung cấp Labo (R-1072): "#RRGGBB" or nothing, which the
/// badges read as grey.
/// </summary>
public class LaboSupplierLabelColorTests
{
    private static LaboSupplier Supplier() => LaboSupplier.Create(Guid.NewGuid(), Guid.NewGuid(), "Labo A");

    [Fact]
    public void A_New_Supplier_Has_No_Colour()
    {
        Supplier().LabelColor.ShouldBeNull();
    }

    [Fact]
    public void A_Hex_Colour_Is_Stored_Upper_Case()
    {
        Supplier().SetLabelColor("#2671d8").LabelColor.ShouldBe("#2671D8");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_Blank_Colour_Clears_It_Back_To_Grey(string? blank)
    {
        var supplier = Supplier().SetLabelColor("#10B981");

        supplier.SetLabelColor(blank).LabelColor.ShouldBeNull();
    }

    [Theory]
    [InlineData("red")]
    [InlineData("#FFF")]
    [InlineData("2671D8")]
    [InlineData("#2671D8FF")]
    [InlineData("#GGGGGG")]
    public void Anything_But_RRGGBB_Is_Refused(string color)
    {
        var supplier = Supplier().SetLabelColor("#10B981");

        var error = Should.Throw<BusinessException>(() => supplier.SetLabelColor(color));

        error.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.InvalidLabelColor);
        supplier.LabelColor.ShouldBe("#10B981");
    }
}
