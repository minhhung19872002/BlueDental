using System.Globalization;
using System.Linq;
using System.Xml.Linq;

namespace BlueDental.EInvoicing;

/// <summary>
/// The provider's <c>XmlData</c> for <c>api/publish/importInvoice</c>
/// (docs/clone/integrations/easyinvoice.md § XmlData). One <c>&lt;Inv&gt;</c>
/// per call — a receipt is one invoice. Built with LINQ to XML so customer
/// names with <c>&amp;</c> or <c>&lt;</c> are escaped rather than trusted.
/// </summary>
public static class EasyInvoiceXmlBuilder
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static string Build(ElectronicInvoiceDraft draft)
    {
        draft.Validated();

        var invoice = new XElement("Invoice",
            new XElement("CusCode", draft.CustomerCode),
            new XElement("Buyer", string.IsNullOrWhiteSpace(draft.BuyerName) ? draft.CustomerName : draft.BuyerName),
            new XElement("CusName", draft.CustomerName),
            new XElement("CusAddress", draft.CustomerAddress ?? string.Empty),
            new XElement("CusPhone", draft.CustomerPhone ?? string.Empty),
            new XElement("CusTaxCode", draft.CustomerTaxCode ?? string.Empty),
            new XElement("PaymentMethod", draft.PaymentMethod),
            draft.ArisingDate is { } date
                ? new XElement("ArisingDate", date.ToString("dd/MM/yyyy", Invariant))
                : null,
            // BlueDental bills in đồng only; a foreign-currency invoice was never
            // tried against the provider (docs/clone/unknowns.md).
            new XElement("CurrencyUnit", "VND"),
            new XElement("ExchangeRate", "1.0000"),
            new XElement("Products", draft.Lines.Select(Product)),
            new XElement("Total", Money(draft.Total)),
            new XElement("VATRate", draft.VatRate.ToString(Invariant)),
            new XElement("VATAmount", Money(draft.TaxAmount)),
            new XElement("Amount", Money(draft.Amount)),
            new XElement("AmountInWords", VietnameseAmountWords.Spell(draft.Amount)));

        var root = new XElement("Invoices",
            new XElement("Inv",
                new XElement("key", draft.Ikey),
                invoice));

        return root.ToString(SaveOptions.DisableFormatting);
    }

    private static XElement Product(ElectronicInvoiceLine line) =>
        new("Product",
            new XElement("Code", line.Code),
            new XElement("ProdName", line.Name),
            new XElement("ProdUnit", line.Unit),
            new XElement("ProdQuantity", line.Quantity.ToString("0.####", Invariant)),
            new XElement("ProdPrice", Money(line.UnitPrice)),
            new XElement("Total", Money(line.Total)),
            new XElement("VATRate", line.VatRate.ToString(Invariant)),
            new XElement("VATAmount", Money(line.TaxAmount)),
            new XElement("Amount", Money(line.Amount)));

    /// <summary>Whole đồng, no separators — what the provider parsed in every probe.</summary>
    private static string Money(decimal value) => decimal.Truncate(value).ToString("0", Invariant);
}
