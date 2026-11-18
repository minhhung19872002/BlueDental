using Shouldly;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>R-1245: the provider's 129 as the "Hóa đơn" dialog shows them.</summary>
public class EasyInvoiceRefusalTests
{
    /// <summary>What sandbox importInvoice answered for an 11-digit MST (KeyInvoiceMsg value, Ikey dropped).</summary>
    private const string TaxCode129 =
        "Dữ liệu không hợp lệ, định dạng Mã số thuế người mua (CusTaxCode) không hợp lệ, giá trị hợp lệ gồm " +
        "10-14 ký tự với mã số thuế công ty hoặc chi nhánh và 12 ký tự với căn cước công dân";

    [Fact]
    public void A_Tax_Code_Refusal_Points_At_The_Tax_Code_Box_In_Plain_Words()
    {
        var refusal = EasyInvoiceRefusal.From(129, TaxCode129);

        refusal.Code.ShouldBe(BlueDentalDomainErrorCodes.EInvoicing.ProviderRefused);
        refusal.Data[EasyInvoiceRefusal.FieldKey].ShouldBe("taxCode");
        refusal.Data[EasyInvoiceRefusal.MessageKey].ShouldBe(
            "Định dạng Mã số thuế người mua không hợp lệ, giá trị hợp lệ gồm 10-14 ký tự với mã số thuế " +
            "công ty hoặc chi nhánh và 12 ký tự với căn cước công dân");
    }

    [Theory]
    [InlineData("định dạng số điện thoại (CusPhone) không hợp lệ", "phone")]
    [InlineData("Địa chỉ (CusAddress) quá dài", "address")]
    [InlineData("Tên đơn vị (CusName) không được để trống", "companyName")]
    [InlineData("Người mua (Buyer) quá dài", "buyerName")]
    public void Each_Buyer_Element_Picks_Its_Box(string error, string field)
    {
        EasyInvoiceRefusal.FieldOf(error).ShouldBe(field);
    }

    [Fact]
    public void A_Refusal_About_Nothing_The_Cashier_Typed_Has_No_Field()
    {
        var refusal = EasyInvoiceRefusal.From(175, "Chữ ký không hợp lệ (Signature) (vd)");

        refusal.Data.Contains(EasyInvoiceRefusal.FieldKey).ShouldBeFalse();
        // Only PascalCase element names go; ordinary words in brackets stay.
        refusal.Data[EasyInvoiceRefusal.MessageKey].ShouldBe("Chữ ký không hợp lệ (vd)");
    }

    [Fact]
    public void No_Answer_Still_Reads_As_Something()
    {
        EasyInvoiceRefusal.Readable(null).ShouldBe("no response");
        EasyInvoiceRefusal.Readable("  ").ShouldBe("no response");
    }

    [Theory]
    [InlineData("0123456787", true)]
    [InlineData("0100112437", true)]
    [InlineData("0101248141-001", true)]
    [InlineData("001234567890", true)]
    [InlineData(" 0123456787 ", true)]
    [InlineData("0123456787001", false)]
    [InlineData("0232323232323", false)]
    [InlineData("0101234567", false)]
    [InlineData("0232323232-001", false)]
    [InlineData("02344444444", false)]
    [InlineData("010123456", false)]
    [InlineData("0123456787-01", false)]
    [InlineData("01012345ab", false)]
    public void Buyer_Tax_Code_Takes_What_EasyInvoice_Takes(string taxCode, bool valid)
    {
        BuyerTaxCode.IsValid(taxCode).ShouldBe(valid);
    }
}
