using System.Linq;
using BlueDental.EInvoicing;
using BlueDental.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.EInvoicing;

public class ElectronicInvoiceMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void ElectronicInvoice_Should_Map_To_bd_electronic_invoices_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(ElectronicInvoice))!
            .GetTableName().ShouldBe("bd_electronic_invoices");
    }

    [Fact]
    public void The_Provider_Key_Is_Unique_And_One_Live_Invoice_Per_Receipt()
    {
        using var ctx = CreateContext();
        var indexes = ctx.Model.FindEntityType(typeof(ElectronicInvoice))!.GetIndexes().ToList();

        var ikey = indexes.Single(i => i.Properties.Count == 1 && i.Properties[0].Name == nameof(ElectronicInvoice.Ikey));
        ikey.IsUnique.ShouldBeTrue();

        var receipt = indexes.Single(i => i.Properties.Count == 1 && i.Properties[0].Name == nameof(ElectronicInvoice.PatientPaymentId));
        receipt.IsUnique.ShouldBeTrue();
        receipt.GetFilter()!.ShouldContain("IsDeleted");
    }

    [Fact]
    public void Money_And_Text_Columns_Are_Bounded()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(ElectronicInvoice))!;

        entity.FindProperty(nameof(ElectronicInvoice.Amount))!.GetPrecision().ShouldBe(18);
        entity.FindProperty(nameof(ElectronicInvoice.Ikey))!.GetMaxLength().ShouldBe(ElectronicInvoice.MaxIkeyLength);
        entity.FindProperty(nameof(ElectronicInvoice.LastError))!.GetMaxLength().ShouldBe(ElectronicInvoice.MaxErrorLength);
        entity.FindProperty(nameof(ElectronicInvoice.Status))!.GetProviderClrType().ShouldBe(typeof(short));
    }

    [Fact]
    public void A_Branch_Has_At_Most_One_Live_Active_Provider_Config()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(EInvoiceProviderConfig))!;
        entity.GetTableName().ShouldBe("bd_einvoice_provider_configs");

        var active = entity.GetIndexes().Single(i => i.IsUnique);
        active.Properties.Single().Name.ShouldBe(nameof(EInvoiceProviderConfig.ClinicBranchId));
        active.GetFilter()!.ShouldContain("IsActive");
        active.GetFilter()!.ShouldContain("IsDeleted");
        entity.FindProperty(nameof(EInvoiceProviderConfig.PasswordCipher))!.GetMaxLength().ShouldBe(1000);
    }
}
