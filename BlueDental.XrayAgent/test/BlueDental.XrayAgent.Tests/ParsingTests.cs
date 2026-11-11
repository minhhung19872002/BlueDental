using System.Xml.Linq;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

public sealed class HintParserTests
{
    private const int ThisYear = 2026;

    [Theory]
    [InlineData(@"C:\x\DH260052_pano.jpg", "DH260052")]
    [InlineData(@"C:\x\dh260052.png", "dh260052")]
    [InlineData(@"C:\x\1234 ceph.jpg", "1234")]
    [InlineData(@"C:\x\IMG_0001.jpg", null)]
    [InlineData(@"C:\x\12.jpg", null)]
    public void Default_pattern_reads_the_code_at_the_start(string path, string? code)
    {
        var parser = new HintParser(AgentSettings.DefaultFileNamePattern, codeFromParentFolder: false);

        parser.Parse(path, ThisYear).Code.ShouldBe(code);
    }

    [Fact]
    public void Named_groups_give_name_and_year_cleaned()
    {
        var parser = new HintParser(@"^(?<name>.+)_(?<year>\d{4})$", codeFromParentFolder: false);

        var hints = parser.Parse(@"C:\x\Tran_Van__B_1990.jpg", ThisYear);

        hints.ShouldBe(new FileNameHints(null, "Tran Van B", 1990));
    }

    [Theory]
    [InlineData("1899")]
    [InlineData("2027")]
    public void Year_outside_1900_to_now_is_dropped(string year)
    {
        var parser = new HintParser(@"^(?<year>\d{4})", codeFromParentFolder: false);

        parser.Parse($@"C:\x\{year}.jpg", ThisYear).BirthYear.ShouldBeNull();
    }

    [Fact]
    public void Code_falls_back_to_the_parent_folder_when_asked()
    {
        var parser = new HintParser(AgentSettings.DefaultFileNamePattern, codeFromParentFolder: true);

        parser.Parse(@"C:\x\DH260099\IMG_0001.jpg", ThisYear).Code.ShouldBe("DH260099");
    }

    [Fact]
    public void Parent_folder_is_ignored_unless_asked()
    {
        var parser = new HintParser(AgentSettings.DefaultFileNamePattern, codeFromParentFolder: false);

        parser.Parse(@"C:\x\DH260099\IMG_0001.jpg", ThisYear).Code.ShouldBeNull();
    }

    [Fact]
    public void A_code_with_unsafe_characters_is_not_sent()
    {
        var parser = new HintParser(@"^(?<code>[^.]+)", codeFromParentFolder: false);

        parser.Parse(@"C:\x\DH 26&0052.jpg", ThisYear).Code.ShouldBeNull();
    }

    [Fact]
    public void Validate_reports_a_broken_pattern()
    {
        HintParser.Validate("(?<code>").ShouldNotBeNull();
        HintParser.Validate(AgentSettings.DefaultFileNamePattern).ShouldBeNull();
    }
}

public sealed class AgentLinkTests
{
    [Fact]
    public void Build_and_parse_round_trip()
    {
        AgentLink.TryParse(AgentLink.Build("DH260052"), out var code).ShouldBeTrue();
        code.ShouldBe("DH260052");
    }

    [Theory]
    [InlineData("bluedental-xray://open?code=DH260052", "DH260052")]
    [InlineData("BLUEDENTAL-XRAY://OPEN/?code=12345", "12345")]
    [InlineData("bluedental-xray://open?x=1&code=A.b_c-1", "A.b_c-1")]
    public void Accepts_good_links(string raw, string expected)
    {
        AgentLink.TryParse(raw, out var code).ShouldBeTrue();
        code.ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://open?code=DH1")]
    [InlineData("bluedental-xray://run?code=DH1")]
    [InlineData("bluedental-xray://open/extra?code=DH1")]
    [InlineData("bluedental-xray://open?code=")]
    [InlineData("bluedental-xray://open?code=DH1%22%20--x")]
    [InlineData("bluedental-xray://open?code=..%5C..%5Cwin")]
    [InlineData("bluedental-xray://open")]
    public void Refuses_anything_else(string? raw)
    {
        AgentLink.TryParse(raw, out _).ShouldBeFalse();
    }

    [Fact]
    public void Refuses_a_code_over_32_characters()
    {
        AgentLink.TryParse("bluedental-xray://open?code=" + new string('1', 33), out _).ShouldBeFalse();
    }
}

public sealed class LinkageXmlTests
{
    private static readonly StationPatient Patient = new(
        "DH260052", "Nguyễn Đức", "Anh", new DateOnly(1990, 3, 7), PatientGender.Female);

    [Fact]
    public void Default_template_renders_valid_xml_with_every_field()
    {
        var xml = LinkageXml.Render(LinkageXml.DefaultTemplate, Patient, unaccent: true);

        var patient = XDocument.Parse(xml).Root!.Element("Patient")!;
        patient.Element("ChartNumber")!.Value.ShouldBe("DH260052");
        patient.Element("LastName")!.Value.ShouldBe("Nguyen Duc");
        patient.Element("FirstName")!.Value.ShouldBe("Anh");
        patient.Element("Birthday")!.Value.ShouldBe("19900307");
        patient.Element("Gender")!.Value.ShouldBe("F");
    }

    [Fact]
    public void Keeps_marks_when_asked()
    {
        LinkageXml.Render("{FullName}", Patient, unaccent: false).ShouldBe("Nguyễn Đức Anh");
    }

    [Fact]
    public void Escapes_markup_and_never_expands_a_value_twice()
    {
        var tricky = Patient with { LastName = "<b>&{ChartNumber}" };

        var text = LinkageXml.Render("{LastName}|{Unknown}", tricky, unaccent: false);

        text.ShouldBe("&lt;b&gt;&amp;{ChartNumber}|{Unknown}");
    }

    [Fact]
    public void Missing_birthday_and_unknown_gender_are_blank()
    {
        var bare = Patient with { DateOfBirth = null, Gender = PatientGender.PreferNotToSay };

        LinkageXml.Render("[{Birthday}][{BirthdayIso}][{Gender}]", bare, unaccent: true).ShouldBe("[][][]");
    }
}
