using System.Collections.Generic;
using BlueDental.Tools;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Tools;

/// <summary>
/// Filling a template for one customer (BA P2110: "trống: Quý khách",
/// "trống: bỏ qua khách") and counting what an SMS costs.
/// </summary>
public class MessageTemplateRendererTests
{
    private static Dictionary<string, string?> Values(params (string Key, string? Value)[] pairs)
    {
        var values = new Dictionary<string, string?>();
        foreach (var (key, value) in pairs)
        {
            values[key] = value;
        }

        return values;
    }

    [Fact]
    public void Known_Variables_Take_The_Customers_Values()
    {
        var result = MessageTemplateRenderer.Render("Chào {xung_ho} {ten_khach_hang}, hẹn {gio_hen}",
            Values(("xung_ho", "Chị"), ("ten_khach_hang", "Lan"), ("gio_hen", "09:30")));

        result.Text.ShouldBe("Chào Chị Lan, hẹn 09:30");
        result.Missing.ShouldBeEmpty();
        result.Unknown.ShouldBeEmpty();
    }

    [Fact]
    public void A_Blank_Value_Falls_Back_Where_The_Variable_Has_A_Fallback()
    {
        var result = MessageTemplateRenderer.Render("Chào {ten_khach_hang}", Values(("ten_khach_hang", "  ")));

        result.Text.ShouldBe("Chào Quý khách");
        result.Missing.ShouldBeEmpty();
    }

    [Fact]
    public void A_Blank_Value_Without_A_Fallback_Is_Reported_Missing_Once()
    {
        var result = MessageTemplateRenderer.Render("{ngay_hen} và {ngay_hen}", Values());

        result.Text.ShouldBe("{ngay_hen} và {ngay_hen}");
        result.Missing.ShouldBe(["ngay_hen"]);
    }

    [Fact]
    public void Unknown_Variables_Stay_In_The_Text_And_Are_Reported()
    {
        var result = MessageTemplateRenderer.Render("Mã {ma_giam_gia}", Values());

        result.Text.ShouldBe("Mã {ma_giam_gia}");
        result.Unknown.ShouldBe(["ma_giam_gia"]);
    }

    [Fact]
    public void Diacritics_Are_Stripped_When_Asked()
    {
        var result = MessageTemplateRenderer.Render("Nhắc lịch hẹn {bac_si}", Values(("bac_si", "BS. Đức")), removeDiacritics: true);

        result.Text.ShouldBe("Nhac lich hen BS. Duc");
    }

    [Fact]
    public void Finding_Variables_Lists_Each_Once_In_First_Seen_Order()
    {
        MessageTemplateRenderer.FindVariables("{gio_hen} {ten_khach_hang} {gio_hen} {Khong_Hop_Le}")
            .ShouldBe(["gio_hen", "ten_khach_hang"]);
    }

    [Theory]
    [InlineData("", 0, 0, 160, false)]
    [InlineData("Hello", 5, 1, 160, false)]
    [InlineData("Chào", 4, 1, 160, false)]
    [InlineData("Lịch", 4, 1, 70, true)]
    [InlineData("{}", 4, 1, 160, false)]
    public void Sms_Length_Counts_By_Alphabet(string text, int characters, int segments, int perMessage, bool unicode)
    {
        SmsLength.Measure(text).ShouldBe(new SmsMeasure(characters, segments, perMessage, unicode));
    }

    [Fact]
    public void Long_Sms_Splits_Into_Parts()
    {
        SmsLength.Measure(new string('a', 161)).Segments.ShouldBe(2);
        SmsLength.Measure(new string('á', 71)).Segments.ShouldBe(2);
        SmsLength.Measure(new string('á', 135)).Segments.ShouldBe(3);
    }
}
