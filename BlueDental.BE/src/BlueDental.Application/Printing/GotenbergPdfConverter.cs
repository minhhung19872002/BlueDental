using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Printing;

/// <summary>Turns a filled .docx into a PDF.</summary>
public interface IDocxPdfConverter
{
    /// <param name="pdfA">A PDF/A level such as <see cref="GotenbergPdfConverter.PdfA2b"/>, for a file kept as the record; null for a plain PDF.</param>
    Task<byte[]> ConvertAsync(byte[] docx, string fileName, string? pdfA = null);
}

/// <summary>
/// Gotenberg's LibreOffice route. The document names the patient, so only the
/// status code is logged, never the body.
/// </summary>
// ABP only exposes an interface named after the class (IGotenbergPdfConverter).
[ExposeServices(typeof(IDocxPdfConverter))]
public class GotenbergPdfConverter(
    IHttpClientFactory httpClientFactory,
    IOptions<PaymentReceiptOptions> options,
    ILogger<GotenbergPdfConverter> logger) : IDocxPdfConverter, ITransientDependency
{
    public const string ClientName = "Gotenberg";

    /// <summary>PDF/A-2b, not 1b: the customer's signature is a PNG with transparency, which 1b forbids.</summary>
    public const string PdfA2b = "PDF/A-2b";

    private const string DocxMediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public async Task<byte[]> ConvertAsync(byte[] docx, string fileName, string? pdfA = null)
    {
        var client = httpClientFactory.CreateClient(ClientName);
        var url = $"{options.Value.GotenbergUrl.TrimEnd('/')}/forms/libreoffice/convert";

        using var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(docx);
        file.Headers.ContentType = new MediaTypeHeaderValue(DocxMediaType);
        content.Add(file, "files", fileName);
        if (pdfA != null)
        {
            content.Add(new StringContent(pdfA), "pdfa");
        }

        try
        {
            using var response = await client.PostAsync(url, content);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Gotenberg conversion failed with {StatusCode}", (int)response.StatusCode);
                throw new BusinessException(BlueDentalDomainErrorCodes.PaymentReceipt.RenderFailed);
            }

            return await response.Content.ReadAsByteArrayAsync();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogError("Gotenberg unreachable at {Url}: {Error}", url, ex.GetType().Name);
            throw new BusinessException(BlueDentalDomainErrorCodes.PaymentReceipt.RenderFailed);
        }
    }
}
