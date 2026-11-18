using System;
using Shouldly;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>The PDF is named as EasyInvoice names it (BA 2026-11-18).</summary>
public class ElectronicInvoicePdfNameTests
{
    // The three names the sandbox sent in Content-Disposition on 2026-11-18.
    [Theory]
    [InlineData(2026, 11, 18, "2026_1118_1C26TYY_0_0318531468.pdf")]
    [InlineData(2026, 10, 6, "2026_106_1C26TYY_0_0318531468.pdf")]
    [InlineData(2026, 9, 29, "2026_929_1C26TYY_0_0318531468.pdf")]
    public void A_Draft_Is_Named_Like_The_Provider_Names_It(int year, int month, int day, string expected)
    {
        ElectronicInvoicePdfName.Build("1C26TYY", null, null, new DateOnly(year, month, day), "0318531468")
            .ShouldBe(expected);
    }

    [Fact]
    public void A_Numbered_Invoice_Carries_Its_Number_And_Serial()
    {
        ElectronicInvoicePdfName.Build("1", "C26TYY", " 12 ", new DateOnly(2026, 11, 18), "0318531468")
            .ShouldBe("2026_1118_1C26TYY_12_0318531468.pdf");
    }

    [Fact]
    public void Nothing_Outside_A_Plain_File_Name_Reaches_The_Name()
    {
        ElectronicInvoicePdfName.Build("1C26/TYY", "a b", "1\"2", new DateOnly(2026, 1, 2), "03185")
            .ShouldBe("2026_12_1C26_TYYa_b_1_2_03185.pdf");
    }

    [Theory]
    [InlineData("2026_1118_1C26TYY_0_0318531468.pdf", "2026_1118_1C26TYY_0_0318531468.pdf")]
    [InlineData("\"2026_1118_1C26TYY_0_0318531468.pdf\"", "2026_1118_1C26TYY_0_0318531468.pdf")]
    [InlineData("../../etc/2026_1118.pdf", "2026_1118.pdf")]
    [InlineData("hoa don.pdf", null)]
    [InlineData("invoice.exe", null)]
    [InlineData(".pdf", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Only_A_Plain_Pdf_Name_From_The_Provider_Is_Kept(string? sent, string? expected)
    {
        ElectronicInvoicePdfName.FromProvider(sent).ShouldBe(expected);
    }
}
