using System.Net;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

public sealed class StationClientTests
{
    private const string Token = "tok-123";

    [Fact]
    public async Task Ping_sends_the_token_to_the_station_root()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"deviceName":"Máy 1","branchName":"CN 1"}""");
        using var client = new StationClient("https://clinic.example/", Token, handler);

        var answer = await client.PingAsync(CancellationToken.None);

        answer.Value.ShouldBe(new StationInfo("Máy 1", "CN 1"));
        handler.Request!.RequestUri!.ToString().ShouldBe("https://clinic.example/api/v1/public/xray-station/");
        handler.Request.Headers.GetValues(StationClient.TokenHeader).Single().ShouldBe(Token);
    }

    [Fact]
    public async Task Upload_posts_multipart_with_hints_and_capture_time()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"inboxItemId":"x","status":2,"duplicate":false}""");
        using var client = new StationClient("https://clinic.example", Token, handler);
        using var content = new MemoryStream([0xFF, 0xD8, 0xFF]);
        var captured = new DateTimeOffset(2026, 11, 11, 1, 2, 3, TimeSpan.Zero);

        var answer = await client.UploadAsync(
            new StationUpload(content, "DH260052.jpg", "image/jpeg", new FileNameHints("DH260052", "Tran B", 1990), captured),
            CancellationToken.None);

        answer.Value.ShouldBe(new UploadReceipt(2, false));
        handler.Request!.Method.ShouldBe(HttpMethod.Post);
        handler.Request.RequestUri!.AbsolutePath.ShouldBe("/api/v1/public/xray-station/images");
        var body = handler.RequestBody!;
        body.ShouldContain("name=file; filename=DH260052.jpg");
        body.ShouldContain("name=code");
        body.ShouldContain("DH260052");
        body.ShouldContain("name=birthYear");
        body.ShouldContain("1990");
        body.ShouldContain("2026-11-11T01:02:03.0000000+00:00");
    }

    [Fact]
    public async Task Patient_lookup_escapes_the_code_and_reads_gender_as_number()
    {
        var handler = new StubHandler(HttpStatusCode.OK,
            """{"patientCode":"DH1","lastName":"A","firstName":"B","dateOfBirth":"1990-03-07","gender":1}""");
        using var client = new StationClient("https://clinic.example", Token, handler);

        var answer = await client.GetPatientByCodeAsync("DH 1", CancellationToken.None);

        handler.Request!.RequestUri!.Query.ShouldBe("?code=DH%201");
        answer.Value.ShouldBe(new StationPatient("DH1", "A", "B", new DateOnly(1990, 3, 7), PatientGender.Male));
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0002", StationFailure.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0003", StationFailure.Rejected)]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0004", StationFailure.Rejected)]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0005", StationFailure.Rejected)]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0006", StationFailure.Unavailable)]
    [InlineData(HttpStatusCode.Forbidden, "BlueDental:Imaging:0009", StationFailure.NotFound)]
    [InlineData(HttpStatusCode.Unauthorized, null, StationFailure.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden, null, StationFailure.Unauthorized)]
    [InlineData(HttpStatusCode.NotFound, null, StationFailure.Unavailable)]
    [InlineData(HttpStatusCode.TooManyRequests, null, StationFailure.Unavailable)]
    [InlineData(HttpStatusCode.BadGateway, null, StationFailure.Unavailable)]
    [InlineData(HttpStatusCode.BadRequest, null, StationFailure.Rejected)]
    [InlineData(HttpStatusCode.RequestEntityTooLarge, null, StationFailure.Rejected)]
    public void Classifies_errors_by_code_first(HttpStatusCode status, string? code, StationFailure expected)
    {
        StationClient.Classify(status, code).ShouldBe(expected);
    }

    [Fact]
    public async Task Reads_the_abp_error_code_from_the_body()
    {
        var handler = new StubHandler(HttpStatusCode.Forbidden, """{"error":{"code":"BlueDental:Imaging:0002","message":"x"}}""");
        using var client = new StationClient("https://clinic.example", Token, handler);

        var answer = await client.PingAsync(CancellationToken.None);

        answer.Failure.ShouldBe(StationFailure.Unauthorized);
        answer.Detail.ShouldBe("BlueDental:Imaging:0002");
    }

    [Fact]
    public async Task A_network_failure_is_unavailable()
    {
        using var client = new StationClient("https://clinic.example", Token, new ThrowingHandler());

        var answer = await client.PingAsync(CancellationToken.None);

        answer.Failure.ShouldBe(StationFailure.Unavailable);
    }

    [Theory]
    [InlineData("https://duchanhpremium.vn", ServerUrlProblem.None)]
    [InlineData("http://localhost:5000", ServerUrlProblem.None)]
    [InlineData("http://127.0.0.1:5000", ServerUrlProblem.None)]
    [InlineData("http://clinic.example", ServerUrlProblem.InsecureHttp)]
    [InlineData("ftp://clinic.example", ServerUrlProblem.Invalid)]
    [InlineData("https://clinic.example?x=1", ServerUrlProblem.Invalid)]
    [InlineData("clinic.example", ServerUrlProblem.Invalid)]
    [InlineData("", ServerUrlProblem.Invalid)]
    public void Server_url_must_be_https_unless_local(string url, ServerUrlProblem expected)
    {
        StationClient.ValidateServerUrl(url).ShouldBe(expected);
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            throw new HttpRequestException("no route");
    }
}
