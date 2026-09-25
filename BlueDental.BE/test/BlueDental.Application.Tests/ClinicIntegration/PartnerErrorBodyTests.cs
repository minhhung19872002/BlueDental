using BlueDental.ClinicIntegration;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.ClinicIntegration;

/// <summary>
/// The reference lists a partner refusal as "{code} — {message}" in the result
/// dialog ("CLINIC_CONN_0001 — Kết nối không tồn tại hoặc chưa được kích hoạt."),
/// so the code and message have to be read out of whatever body the partner sends.
/// </summary>
public class PartnerErrorBodyTests
{
    [Theory]
    [InlineData("{\"code\":\"CLINIC_CONN_0001\",\"message\":\"Kết nối không tồn tại hoặc chưa được kích hoạt.\"}")]
    [InlineData("{\"errorCode\":\"CLINIC_CONN_0001\",\"message\":\"Kết nối không tồn tại hoặc chưa được kích hoạt.\"}")]
    [InlineData("{\"statusCode\":403,\"error\":{\"code\":\"CLINIC_CONN_0001\",\"message\":\"Kết nối không tồn tại hoặc chưa được kích hoạt.\"}}")]
    public void Reads_The_Partners_Code_And_Message_In_Every_Common_Shape(string body)
    {
        var refusal = HttpClinicPartnerClient.ReadPartnerError(body);

        refusal.ShouldNotBeNull();
        refusal.Value.Code.ShouldBe("CLINIC_CONN_0001");
        refusal.Value.Message.ShouldBe("Kết nối không tồn tại hoặc chưa được kích hoạt.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("<html>Bad Gateway</html>")]
    [InlineData("{\"results\":[]}")]
    [InlineData("[1,2]")]
    public void Says_Nothing_When_The_Body_Names_No_Error(string? body)
    {
        HttpClinicPartnerClient.ReadPartnerError(body).ShouldBeNull();
    }
}
