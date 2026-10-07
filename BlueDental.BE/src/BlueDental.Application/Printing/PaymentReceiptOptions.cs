namespace BlueDental.Printing;

/// <summary>Where the PHIẾU THU template lives and which Gotenberg renders it.</summary>
public class PaymentReceiptOptions
{
    public const string SectionName = "PaymentReceipt";

    /// <summary>The .docx with the <c>{{…}}</c> placeholders; a relative path resolves against the host's content root.</summary>
    public string TemplatePath { get; set; } = "wwwroot/templates/PHIẾU THU.docx";

    /// <summary>Gotenberg (LibreOffice behind an HTTP API), run as its own container.</summary>
    public string GotenbergUrl { get; set; } = "http://127.0.0.1:13000";

    public int TimeoutSeconds { get; set; } = 60;
}
