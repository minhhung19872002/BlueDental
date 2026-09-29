using Xunit;

namespace BlueDental.EInvoicing;

public class VietnameseAmountWordsTests
{
    [Theory]
    [InlineData(0, "Không đồng")]
    [InlineData(5, "Năm đồng")]
    [InlineData(15, "Mười lăm đồng")]
    [InlineData(21, "Hai mươi mốt đồng")]
    [InlineData(105, "Một trăm lẻ năm đồng")]
    [InlineData(1_000, "Một nghìn đồng")]
    [InlineData(1_005, "Một nghìn không trăm lẻ năm đồng")]
    [InlineData(500_000, "Năm trăm nghìn đồng")]
    [InlineData(1_250_000, "Một triệu hai trăm năm mươi nghìn đồng")]
    [InlineData(2_000_000_000, "Hai tỷ đồng")]
    [InlineData(1_000_000_001, "Một tỷ không trăm lẻ một đồng")]
    public void Spells_Whole_Dong_The_Way_The_Receipt_Does(long amount, string expected)
    {
        Assert.Equal(expected, VietnameseAmountWords.Spell(amount));
    }

    [Fact]
    public void Fractions_Of_A_Dong_Are_Dropped()
    {
        Assert.Equal("Một trăm đồng", VietnameseAmountWords.Spell(100.4m));
    }
}
