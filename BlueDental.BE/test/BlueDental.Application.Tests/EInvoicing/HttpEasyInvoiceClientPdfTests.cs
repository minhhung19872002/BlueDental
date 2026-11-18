using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Shouldly;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>
/// getInvoicePdf names its file in Content-Disposition; the download keeps
/// that name (BA 2026-11-18). The response here is the sandbox's, headers
/// as read that day.
/// </summary>
public class HttpEasyInvoiceClientPdfTests
{
    private static readonly byte[] Pdf = "%PDF-1.4 sample"u8.ToArray();

    private static readonly EasyInvoiceSettings Settings =
        new(null, "http://easyinvoice.test", "API", "secret", "0318531468", "1C26TYY", null, -1);

    [Fact]
    public async Task The_Pdf_Comes_With_The_Name_The_Provider_Gave_It()
    {
        var result = await GetPdfAsync("attachment; filename=2026_1118_1C26TYY_0_0318531468.pdf");

        result.Succeeded.ShouldBeTrue();
        result.Data.ShouldBe(Pdf);
        result.FileName.ShouldBe("2026_1118_1C26TYY_0_0318531468.pdf");
    }

    [Fact]
    public async Task No_Name_Or_A_Strange_One_Leaves_The_Name_To_BlueDental()
    {
        (await GetPdfAsync(null)).FileName.ShouldBeNull();
        (await GetPdfAsync("attachment; filename=\"hóa đơn.pdf\"")).FileName.ShouldBeNull();
    }

    private static Task<EasyInvoiceCallResult<byte[]>> GetPdfAsync(string? disposition)
    {
        var content = new ByteArrayContent(Pdf);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        if (disposition != null)
        {
            content.Headers.ContentDisposition = ContentDispositionHeaderValue.Parse(disposition);
        }

        var client = new HttpEasyInvoiceClient(new OneResponseFactory(new HttpResponseMessage(HttpStatusCode.OK) { Content = content }));
        return client.GetPdfAsync(Settings, "bd-sample");
    }

    private sealed class OneResponseFactory(HttpResponseMessage response) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(new OneResponseHandler(response));
    }

    private sealed class OneResponseHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(response);
    }
}
