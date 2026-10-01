using System.Linq;
using System.Xml.Linq;
using Volo.Abp;
using Xunit;

namespace BlueDental.EInvoicing;

public class EasyInvoiceXmlBuilderTests
{
    private static ElectronicInvoiceDraft Draft(int vatRate = -1, string name = "Trám răng <composite> & đánh bóng") =>
        new()
        {
            Ikey = "bd-test",
            CustomerCode = "BN0001",
            CustomerName = "Nguyễn Văn Test",
            CustomerAddress = "12 Lê Lợi",
            CustomerPhone = "0900000000",
            PaymentMethod = ElectronicInvoiceDraft.CashPaymentMethod,
            VatRate = vatRate,
            Lines =
            [
                ElectronicInvoiceDraft.Line("TR01", name, "Lần", 1m, 500_000m, vatRate),
                ElectronicInvoiceDraft.Line("NR02", "Nhổ răng", "Răng", 2m, 150_000m, vatRate),
            ]
        };

    [Fact]
    public void Builds_The_Provider_Envelope_With_Key_And_Totals()
    {
        var xml = XDocument.Parse(EasyInvoiceXmlBuilder.Build(Draft()));

        var inv = xml.Root!.Element("Inv")!;
        Assert.Equal("Invoices", xml.Root.Name.LocalName);
        Assert.Equal("bd-test", inv.Element("key")!.Value);

        var invoice = inv.Element("Invoice")!;
        Assert.Equal("BN0001", invoice.Element("CusCode")!.Value);
        Assert.Equal("Nguyễn Văn Test", invoice.Element("Buyer")!.Value);
        Assert.Equal("Nguyễn Văn Test", invoice.Element("CusName")!.Value);
        Assert.Equal("Tiền mặt", invoice.Element("PaymentMethod")!.Value);
        Assert.Equal("VND", invoice.Element("CurrencyUnit")!.Value);
        Assert.Equal("800000", invoice.Element("Total")!.Value);
        Assert.Equal("0", invoice.Element("VATAmount")!.Value);
        Assert.Equal("800000", invoice.Element("Amount")!.Value);
        Assert.Equal("Tám trăm nghìn đồng", invoice.Element("AmountInWords")!.Value);
        Assert.Equal(2, invoice.Element("Products")!.Elements("Product").Count());
    }

    [Fact]
    public void Special_Characters_In_Names_Are_Escaped_Not_Broken()
    {
        var xml = XDocument.Parse(EasyInvoiceXmlBuilder.Build(Draft()));
        var first = xml.Descendants("Product").First();

        Assert.Equal("Trám răng <composite> & đánh bóng", first.Element("ProdName")!.Value);
        Assert.Equal("1", first.Element("ProdQuantity")!.Value);
        Assert.Equal("500000", first.Element("ProdPrice")!.Value);
    }

    [Fact]
    public void Positive_Vat_Adds_Tax_Per_Line_And_On_The_Invoice()
    {
        var xml = XDocument.Parse(EasyInvoiceXmlBuilder.Build(Draft(vatRate: 10)));
        var invoice = xml.Descendants("Invoice").Single();

        Assert.Equal("10", invoice.Element("VATRate")!.Value);
        Assert.Equal("80000", invoice.Element("VATAmount")!.Value);
        Assert.Equal("880000", invoice.Element("Amount")!.Value);
        Assert.Equal("30000", xml.Descendants("Product").Last().Element("VATAmount")!.Value);
    }

    [Fact]
    public void A_Draft_Without_Lines_Or_Customer_Is_Refused_Before_It_Leaves()
    {
        var empty = Draft() with { Lines = [] };
        var nameless = Draft() with { CustomerName = " " };

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft,
            Assert.Throws<BusinessException>(() => empty.Validated()).Code);
        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.InvalidDraft,
            Assert.Throws<BusinessException>(() => nameless.Validated()).Code);
    }

    [Fact]
    public void A_Company_Invoice_Names_The_Company_And_Keeps_The_Person_As_Buyer()
    {
        var draft = Draft() with { CustomerName = "Công ty TNHH Test", BuyerName = "Nguyễn Văn Test" };
        var invoice = XDocument.Parse(EasyInvoiceXmlBuilder.Build(draft)).Descendants("Invoice").Single();

        Assert.Equal("Nguyễn Văn Test", invoice.Element("Buyer")!.Value);
        Assert.Equal("Công ty TNHH Test", invoice.Element("CusName")!.Value);
    }

    [Fact]
    public void The_Invoice_Date_Is_Sent_Only_When_Chosen()
    {
        var stamped = XDocument.Parse(EasyInvoiceXmlBuilder.Build(Draft() with { ArisingDate = new System.DateTime(2026, 10, 1) }));
        var unstamped = XDocument.Parse(EasyInvoiceXmlBuilder.Build(Draft()));

        Assert.Equal("01/10/2026", stamped.Descendants("ArisingDate").Single().Value);
        Assert.Empty(unstamped.Descendants("ArisingDate"));
    }

    [Fact]
    public void Mixed_Vat_Rates_Or_An_Unknown_Rate_Are_Refused()
    {
        var mixed = Draft(8) with
        {
            Lines = [ElectronicInvoiceDraft.Line("A", "A", "Lần", 1m, 100m, 8), ElectronicInvoiceDraft.Line("B", "B", "Lần", 1m, 100m, 10)]
        };
        var unknown = Draft(7);

        Assert.Throws<BusinessException>(() => mixed.Validated());
        Assert.Throws<BusinessException>(() => unknown.Validated());
    }

    [Fact]
    public void A_Line_Without_Quantity_Is_Refused()
    {
        var draft = Draft() with { Lines = [ElectronicInvoiceDraft.Line("A", "A", "Lần", 0m, 100m, -1)] };

        Assert.Throws<BusinessException>(() => draft.Validated());
    }
}
