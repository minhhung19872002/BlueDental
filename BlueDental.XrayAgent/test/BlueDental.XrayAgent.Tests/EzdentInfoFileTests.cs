using System.Text;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

/// <summary>Synthetic samples shaped like EzDent-i 3.5.3's "Thêm Tệp Thông tin Hình ảnh" file.</summary>
public sealed class EzdentInfoFileTests
{
    private const int ThisYear = 2026;

    private const string Sample =
        "Chart No : 123456\r\n" +
        "Name : NGUYEN VAN A^\r\n" +
        "Birthday : 1990-05-17\r\n" +
        "Image Type : Panorama\r\n" +
        "kVp : 73\r\n" +
        "mA : 10.00\r\n" +
        "DAP : 1.106 dGycm²\r\n" +
        "Acquisition Date : 2026-11-11T11:01:06+07:00\r\n";

    [Fact]
    public void Reads_code_name_birth_year_and_acquisition_time()
    {
        var info = EzdentInfoFile.Parse(Sample, ThisYear);

        info.Code.ShouldBe("123456");
        info.Name.ShouldBe("NGUYEN VAN A");
        info.BirthYear.ShouldBe(1990);
        info.AcquiredAt.ShouldBe(new DateTimeOffset(2026, 11, 11, 11, 1, 6, TimeSpan.FromHours(7)));
    }

    [Theory]
    [InlineData("chart no:DH260052", "DH260052")]
    [InlineData("CHART NO :  0042 ", "0042")]
    [InlineData("Chart No : 12 34", null)]
    [InlineData("Chart No : 12&34", null)]
    [InlineData("Chart No :", null)]
    public void Chart_no_must_be_a_safe_code(string line, string? code)
    {
        EzdentInfoFile.Parse(line, ThisYear).Code.ShouldBe(code);
    }

    [Theory]
    [InlineData("Birthday : 1899-12-31")]
    [InlineData("Birthday : 2027-01-01")]
    [InlineData("Birthday : 17/05/1990")]
    [InlineData("Birthday : ")]
    public void Birthday_outside_1900_to_now_or_of_unknown_shape_is_dropped(string line)
    {
        EzdentInfoFile.Parse(line, ThisYear).BirthYear.ShouldBeNull();
    }

    [Fact]
    public void Dicom_name_parts_become_spaces_and_an_empty_name_is_null()
    {
        EzdentInfoFile.Parse("Name : TRAN^THI^B", ThisYear).Name.ShouldBe("TRAN THI B");
        EzdentInfoFile.Parse("Name : ^", ThisYear).Name.ShouldBeNull();
    }

    [Fact]
    public void Text_without_known_keys_is_empty()
    {
        EzdentInfoFile.Parse("kVp : 73\nnot a field\n: no key", ThisYear).IsEmpty.ShouldBeTrue();
    }

    [Fact]
    public void Finds_the_file_with_the_same_base_name_and_prefers_txt()
    {
        using var temp = new TempFolder();
        var picture = temp.Write("PX20261111_110106_1_1.png", [1]);
        temp.Write("PX20261111_110106_1_1.dcm", [1]);
        temp.Write("PX20261111_110106_1_10.txt", [1]);
        temp.Write("PX20261111_110106_1_1.inf", [1]);
        var txt = temp.Write("PX20261111_110106_1_1.txt", [1]);

        EzdentInfoFile.FindFor(picture).ShouldBe(txt);
    }

    [Fact]
    public void No_information_file_gives_null()
    {
        using var temp = new TempFolder();
        var picture = temp.Write("PX20261111_110106_1_1.png", [1]);
        temp.Write("PX20261111_110106_1_1.jpg", [1]);

        EzdentInfoFile.FindFor(picture).ShouldBeNull();
    }

    [Fact]
    public void Reads_utf16_and_latin1_files()
    {
        using var temp = new TempFolder();
        var utf16 = temp.Write("a.txt", [.. Encoding.Unicode.GetPreamble(), .. Encoding.Unicode.GetBytes(Sample)]);
        var latin1 = temp.Write("b.txt", Encoding.Latin1.GetBytes(Sample));

        EzdentInfoFile.TryRead(utf16, ThisYear)!.Code.ShouldBe("123456");
        EzdentInfoFile.TryRead(latin1, ThisYear)!.BirthYear.ShouldBe(1990);
    }

    [Fact]
    public void A_file_too_big_to_be_the_information_file_is_not_read()
    {
        using var temp = new TempFolder();
        var big = temp.Write("a.txt", Encoding.UTF8.GetBytes(Sample + new string('x', EzdentInfoFile.MaxBytes)));

        EzdentInfoFile.TryRead(big, ThisYear).ShouldBeNull();
    }
}
