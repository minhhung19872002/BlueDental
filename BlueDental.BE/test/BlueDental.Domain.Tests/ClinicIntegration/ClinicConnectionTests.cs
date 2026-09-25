using System;
using Volo.Abp;
using Xunit;

namespace BlueDental.ClinicIntegration;

public class ClinicConnectionTests
{
    private static readonly DateTime At = new(2026, 9, 25, 9, 0, 0, DateTimeKind.Utc);

    private static ClinicConnection NewConnection(string url = "https://partner.example.com/api/") =>
        new(Guid.NewGuid(), Guid.NewGuid(), url, "cipher");

    private static ClinicConnection ActiveConnection()
    {
        var connection = NewConnection();
        connection.RecordHandshake(true, null, At);
        return connection;
    }

    [Theory]
    [InlineData("partner.example.com")]
    [InlineData("ftp://partner.example.com")]
    [InlineData("https://partner.example.com/api?key=1")]
    [InlineData("http://partner.example.com")]
    public void Refuses_A_Base_Url_That_Is_Not_Https_Or_Loopback(string url)
    {
        var ex = Assert.Throws<BusinessException>(() => NewConnection(url));
        Assert.Equal(BlueDentalDomainErrorCodes.ClinicIntegration.InvalidPartnerUrl, ex.Code);
    }

    [Theory]
    [InlineData("http://127.0.0.1:5099")]
    [InlineData("http://localhost:5099/partner")]
    public void Allows_Plain_Http_Only_On_Loopback(string url)
    {
        Assert.Equal(url, NewConnection(url).BaseUrl);
    }

    [Fact]
    public void Starts_Pending_With_The_Trailing_Slash_Trimmed()
    {
        var connection = NewConnection();

        Assert.Equal(ClinicConnectionStatus.Pending, connection.Status);
        Assert.Equal("https://partner.example.com/api", connection.BaseUrl);
        Assert.False(connection.CanSyncServiceCatalog);
    }

    [Fact]
    public void Cannot_Switch_Sync_On_Before_A_Handshake_Succeeds()
    {
        var connection = NewConnection();

        var ex = Assert.Throws<BusinessException>(() => connection.SetSyncFlags(null, true));
        Assert.Equal(BlueDentalDomainErrorCodes.ClinicIntegration.ConnectionNotActive, ex.Code);
    }

    [Fact]
    public void Switching_Sync_Off_Is_Always_Allowed()
    {
        var connection = NewConnection();

        connection.SetSyncFlags(false, false);

        Assert.False(connection.ServiceCatalogSyncEnabled);
    }

    [Fact]
    public void An_Active_Link_With_The_Flag_On_Can_Sync_The_Catalog()
    {
        var connection = ActiveConnection();

        connection.SetSyncFlags(null, true);

        Assert.True(connection.CanSyncServiceCatalog);
        Assert.False(connection.CanSyncInvoices);
        connection.EnsureCanSyncServiceCatalog();
    }

    [Fact]
    public void A_Null_Flag_Leaves_That_Flag_As_It_Was()
    {
        var connection = ActiveConnection();
        connection.SetSyncFlags(true, true);

        connection.SetSyncFlags(null, false);

        Assert.True(connection.InvoiceSyncEnabled);
        Assert.False(connection.ServiceCatalogSyncEnabled);
    }

    [Fact]
    public void A_Refused_Handshake_Records_Why_And_Blocks_Syncing()
    {
        var connection = ActiveConnection();
        connection.SetSyncFlags(null, true);

        connection.RecordHandshake(false, "HTTP 401: bad key", At.AddMinutes(5));

        Assert.Equal(ClinicConnectionStatus.Failed, connection.Status);
        Assert.Equal("HTTP 401: bad key", connection.LastError);
        Assert.False(connection.CanSyncServiceCatalog);
        var ex = Assert.Throws<BusinessException>(connection.EnsureCanSyncServiceCatalog);
        Assert.Equal(BlueDentalDomainErrorCodes.ClinicIntegration.ServiceCatalogSyncDisabled, ex.Code);
    }

    [Fact]
    public void New_Credentials_Must_Be_Proven_Again()
    {
        var connection = ActiveConnection();
        connection.SetSyncFlags(null, true);

        var urlChanged = connection.ChangeCredentials("https://partner.example.com/api", "new-cipher");

        Assert.False(urlChanged);
        Assert.Equal(ClinicConnectionStatus.Pending, connection.Status);
        Assert.Equal("new-cipher", connection.ApiKeyCipher);
        Assert.False(connection.CanSyncServiceCatalog);
    }

    [Fact]
    public void A_Blank_Key_Keeps_The_Stored_One_And_A_New_Host_Is_Reported()
    {
        var connection = NewConnection();

        var urlChanged = connection.ChangeCredentials("https://other-partner.example.com", null);

        Assert.True(urlChanged);
        Assert.Equal("cipher", connection.ApiKeyCipher);
    }
}
