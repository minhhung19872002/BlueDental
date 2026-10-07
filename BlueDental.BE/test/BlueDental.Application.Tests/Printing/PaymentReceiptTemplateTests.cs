using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using BlueDental.Printing;
using Shouldly;
using Volo.Abp.DependencyInjection;
using Xunit;

namespace BlueDental.Application.Tests.Printing;

/// <summary>
/// The shipped PHIẾU THU template against the values the server fills in:
/// every placeholder must sit in one run, or Fill leaves braces on the paper.
/// </summary>
public class PaymentReceiptTemplateTests
{
    private static readonly PaymentReceiptContent Sample = new(
        CustomerName: "Khách <Thử> & Co",
        TreatmentWork: "Cạo vôi răng, Trám răng",
        PaidAmount: 15_000_000m,
        SlipTotal: 20_500_000m,
        PayerName: "Bệnh nhân Thử",
        IssueDate: new DateOnly(2026, 10, 7),
        CashierName: "Thu Ngân Thử");

    [Fact]
    public void Every_Placeholder_In_The_Shipped_Template_Is_Filled()
    {
        var filled = DocxTemplate.Fill(File.ReadAllBytes(TemplatePath()), Sample.ToPlaceholders());

        var xml = DocumentXml(filled);
        xml.ShouldNotContain("{{");
        xml.ShouldContain("Khách &lt;Thử&gt; &amp; Co");
        xml.ShouldContain("Cạo vôi răng, Trám răng");
        xml.ShouldContain("15.000.000 đ");
        xml.ShouldContain("Mười lăm triệu đồng");
        xml.ShouldContain("5.500.000 đ");
        xml.ShouldContain("07/10/2026");
        xml.ShouldContain("Thu Ngân Thử");
        xml.ShouldContain("Bệnh nhân Thử");
    }

    [Fact]
    public void The_Template_Holds_Exactly_The_Keys_The_Server_Fills()
    {
        var xml = DocumentXml(File.ReadAllBytes(TemplatePath()));
        var keys = Regex.Matches(xml, @"\{\{(\w+)\}\}").Select(m => m.Groups[1].Value).OrderBy(k => k);

        keys.ShouldBe(Sample.ToPlaceholders().Keys.OrderBy(k => k));
    }

    [Fact]
    public void Remaining_Is_The_Slip_Total_Less_What_Is_Paid_And_Never_Negative()
    {
        Sample.RemainingAmount.ShouldBe(5_500_000m);
        (Sample with { PaidAmount = 30_000_000m }).RemainingAmount.ShouldBe(0m);
    }

    [Theory]
    [InlineData(0, "0 đ")]
    [InlineData(999, "999 đ")]
    [InlineData(1_234_567.5, "1.234.568 đ")]
    public void Money_Is_Whole_Dong_With_Dot_Grouping(decimal amount, string expected) =>
        PaymentReceiptContent.Money(amount).ShouldBe(expected);

    /// <summary>The app service asks for the interface; ABP's naming convention alone would not register it.</summary>
    [Fact]
    public void Gotenberg_Is_Registered_As_The_Docx_Pdf_Converter() =>
        typeof(GotenbergPdfConverter).GetCustomAttribute<ExposeServicesAttribute>()!
            .ServiceTypes.ShouldContain(typeof(IDocxPdfConverter));

    private static string DocumentXml(byte[] docx)
    {
        using var zip = new ZipArchive(new MemoryStream(docx));
        using var reader = new StreamReader(zip.GetEntry("word/document.xml")!.Open());
        return reader.ReadToEnd();
    }

    /// <summary>The template the host serves, found from the test's bin folder up to the repo.</summary>
    private static string TemplatePath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "BlueDental.HttpApi.Host", "wwwroot", "templates", "PHIẾU THU.docx");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new FileNotFoundException("PHIẾU THU.docx not found above " + AppContext.BaseDirectory);
    }
}
