using System.Linq;
using BlueDental.EntityFrameworkCore;
using BlueDental.Imaging;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Imaging;

public class XrayMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void Device_Token_Hash_Is_Unique()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(XrayDevice))!;
        entity.GetTableName().ShouldBe("bd_xray_devices");
        entity.GetIndexes().ShouldContain(ix =>
            ix.IsUnique && ix.Properties.Single().Name == nameof(XrayDevice.TokenHash));
    }

    [Fact]
    public void One_Device_Cannot_Log_The_Same_File_Twice()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(XrayInboxItem))!;
        entity.GetTableName().ShouldBe("bd_xray_inbox_items");
        entity.FindProperty(nameof(XrayInboxItem.Status))!.GetProviderClrType().ShouldBe(typeof(short));
        entity.GetIndexes().ShouldContain(ix =>
            ix.IsUnique
            && ix.Properties.Count == 2
            && ix.Properties[0].Name == nameof(XrayInboxItem.XrayDeviceId)
            && ix.Properties[1].Name == nameof(XrayInboxItem.Sha256));
    }

    [Fact]
    public void Patient_Image_Staff_Is_Optional_For_Xray_Pictures()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientImage))!;
        entity.FindProperty(nameof(PatientImage.StaffId))!.IsNullable.ShouldBeTrue();
        entity.FindProperty(nameof(PatientImage.XrayDeviceId))!.IsNullable.ShouldBeTrue();
    }
}
