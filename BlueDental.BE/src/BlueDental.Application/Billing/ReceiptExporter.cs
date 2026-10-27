using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using BlueDental.EInvoicing;
using BlueDental.Printing;
using BlueDental.TreatmentManagement;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;

namespace BlueDental.Billing;

/// <summary>Where an exported receipt went and the SHA-256 it must still have when read.</summary>
public sealed record ExportedReceipt(string FileName, string Sha256);

/// <summary>
/// "Xuất phiếu thu" (P2610 phase 5): the PHIẾU THU as the customer checked
/// it on the iPad, with their signature above Người nộp tiền, written once to
/// PDF/A, sealed with the receipt key and kept in blob storage. Every read
/// re-checks the SHA-256 taken at export, so a file changed in storage is
/// refused rather than printed. Logs carry ids only — the file names the
/// patient.
/// </summary>
public class ReceiptExporter(
    IRepository<ReceiptSigningSession, Guid> sessions,
    PaymentReceiptContents contents,
    PaymentReceiptTemplate template,
    IDocxPdfConverter converter,
    InvoiceRequestSources invoiceRequests,
    IReceiptCipher cipher,
    IBlobContainer blobs,
    IGuidGenerator guidGenerator,
    ILogger<ReceiptExporter> logger) : ITransientDependency
{
    /// <summary>The room the template leaves above {{PayerName}}: four blank lines of a 62 mm column.</summary>
    public const double SignatureMaxWidthMm = 50;
    public const double SignatureMaxHeightMm = 18;

    private const string PayerPlaceholder = "{{PayerName}}";

    public async Task<ExportedReceipt> ExportAsync(PatientPayment payment, ReceiptSignMode signMode)
    {
        payment.EnsureIssuable(signMode);

        var session = await sessions.FirstOrDefaultAsync(x => x.PatientPaymentId == payment.Id && x.ClosedAt == null);
        if (session is not { IsSigned: true, SignatureCipher: { } signature })
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptNotSignedByCustomer);
        }

        var pdf = await RenderAsync(payment, await contents.ContentOfAsync(payment), cipher.Decrypt(signature));
        var fileName = FileNameOf(payment);
        await blobs.SaveAsync(fileName, cipher.Seal(pdf), overrideExisting: true);
        return new ExportedReceipt(fileName, Sha256Of(pdf));
    }

    public async Task<byte[]> ReadAsync(PatientPayment payment)
    {
        if (payment.ReceiptFileName is not { } fileName || payment.ReceiptFileSha256 is not { } expected)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptFileMissing);
        }

        var sealedFile = await blobs.GetAllBytesOrNullAsync(fileName);
        if (sealedFile == null)
        {
            logger.LogError("Exported receipt {PaymentId} is missing from blob storage", payment.Id);
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptFileMissing);
        }

        byte[] pdf;
        try
        {
            pdf = cipher.Open(sealedFile);
        }
        catch (CryptographicException)
        {
            logger.LogError("Exported receipt {PaymentId} does not decrypt", payment.Id);
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptFileTampered);
        }

        if (!string.Equals(Sha256Of(pdf), expected, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError("Exported receipt {PaymentId} no longer matches its SHA-256", payment.Id);
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptFileTampered);
        }

        return pdf;
    }

    /// <summary>
    /// The F-56 PHIẾU THU filled from the frozen content: Số tiền còn lại is
    /// the content's own, so the file says what the iPad showed.
    /// </summary>
    private async Task<byte[]> RenderAsync(PatientPayment payment, PaymentReceiptSnapshot content, byte[] signaturePng)
    {
        var placeholders = new PaymentReceiptContent(
            CustomerName: content.PayerName,
            TreatmentWork: string.Join(", ", content.Lines.Select(l => l.Name).Distinct()),
            PaidAmount: content.Amount,
            SlipTotal: content.Remaining + content.Amount,
            PayerName: content.PayerName,
            IssueDate: ClinicCalendar.DateOf(DateTime.SpecifyKind(payment.CreationTime, DateTimeKind.Utc)),
            CashierName: content.CreatorName).ToPlaceholders();

        var docx = DocxPicture.PlaceAbove(
            await template.LoadAsync(), PayerPlaceholder, signaturePng,
            SignatureMaxWidthMm, SignatureMaxHeightMm, "customer-signature");
        docx = DocxTemplate.Fill(docx, placeholders);
        docx = payment.RedInvoiceRequested
            ? PaymentReceiptQr.Place(docx, invoiceRequests.PublicUrlOf(
                await invoiceRequests.EnsureLinkAsync(payment, guidGenerator.Create())))
            : PaymentReceiptQr.Leave(docx);

        return await converter.ConvertAsync(docx, "phieu-thu.docx", GotenbergPdfConverter.PdfA2b);
    }

    private static string FileNameOf(PatientPayment payment) =>
        $"receipts/{payment.ClinicBranchId}/{payment.Id}.pdf.enc";

    private static string Sha256Of(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
}
