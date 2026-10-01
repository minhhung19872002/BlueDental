using System;
using Volo.Abp;
using Xunit;

namespace BlueDental.EInvoicing;

public class EInvoiceProviderConfigTests
{
    private static readonly EasyInvoiceOptions Server = new()
    {
        BaseUrl = "http://api.softdreams.vn/",
        Pattern = "1C26TYY",
        Serial = "C26TAA",
        VatRate = -1
    };

    private static EInvoiceProviderConfig Config(string name = "Chi nhánh 1", string? appId = " ") =>
        new(Guid.NewGuid(), Guid.NewGuid(), name, appId, "user", "cipher-1",
            "0100000000", taxByService: true, taxByPeriod: false, isActive: true);

    [Fact]
    public void The_Original_Form_Fields_Are_Kept_And_A_Blank_App_Id_Is_Null()
    {
        var config = Config();

        Assert.Null(config.AppId);
        Assert.True(config.TaxByService);
        Assert.False(config.TaxByPeriod);
        Assert.Equal(ElectronicInvoice.EasyInvoiceProvider, config.Provider);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void A_Blank_Name_Is_Refused_By_The_Server_Since_The_Form_Has_No_Rules(string name)
    {
        var error = Assert.Throws<BusinessException>(() => Config(name));

        Assert.Equal(BlueDentalDomainErrorCodes.EInvoicing.ConfigIncomplete, error.Code);
    }

    [Fact]
    public void An_Edit_Without_A_Password_Keeps_The_Stored_One()
    {
        var config = Config();

        config.Change("Chi nhánh 1", "app-1", "user", null, "0100000000", false, true, false);
        Assert.Equal("cipher-1", config.PasswordCipher);
        Assert.Equal("app-1", config.AppId);
        Assert.False(config.IsActive);

        config.Change("Chi nhánh 1", null, "user", "cipher-2", "0100000000", false, false, true);
        Assert.Equal("cipher-2", config.PasswordCipher);
    }

    [Fact]
    public void Until_It_Has_Issued_It_Suggests_The_Server_Numbering_And_Url()
    {
        var config = Config();
        var settings = config.ToSettings("plain", Server);

        Assert.Equal(config.Id, settings.ConfigId);
        Assert.Equal("http://api.softdreams.vn", settings.BaseUrl);
        Assert.Equal("1C26TYY", settings.Pattern);
        Assert.Equal("C26TAA", settings.Serial);
        Assert.Equal("plain", settings.Password);
        Assert.DoesNotContain("plain", settings.ToString());
    }

    [Fact]
    public void After_Issuing_It_Suggests_The_Numbering_It_Last_Used()
    {
        var config = Config();

        config.RememberNumbering(" 2C26TAA ", " ");
        var settings = config.ToSettings("plain", Server);

        Assert.Equal("2C26TAA", settings.Pattern);
        Assert.Null(settings.Serial);
    }
}
