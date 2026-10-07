using System;
using System.Linq;
using System.Reflection;
using BlueDental.EInvoicing;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.EInvoicing;

public class ElectronicInvoiceAppServiceContractTests
{
    [Fact]
    public void AppService_Implements_Its_Interface_And_Requires_A_Signed_In_User()
    {
        typeof(IElectronicInvoiceAppService).IsAssignableFrom(typeof(ElectronicInvoiceAppService)).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(typeof(ElectronicInvoiceAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(ElectronicInvoiceAppService)).ShouldBeTrue();
        typeof(ElectronicInvoiceAppService).GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void Issuing_Needs_The_Payment_Finalize_Ability_And_Reading_Needs_Payment_Read()
    {
        Policy(nameof(ElectronicInvoiceAppService.IssueFromPaymentAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Finalize);
        Policy(nameof(ElectronicInvoiceAppService.IssueAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Finalize);
        Policy(nameof(ElectronicInvoiceAppService.GetDraftAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        Policy(nameof(ElectronicInvoiceAppService.GetListAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        Policy(nameof(ElectronicInvoiceAppService.SyncAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        Policy(nameof(ElectronicInvoiceAppService.GetPdfAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        // PHIẾU THU says money was collected: same ability as Phát Hành.
        Policy(nameof(ElectronicInvoiceAppService.RenderReceiptAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Finalize);
    }

    [Fact]
    public void The_Provider_Account_Never_Travels_Back_To_A_Client()
    {
        var properties = typeof(ElectronicInvoiceDto).GetProperties().Select(p => p.Name).ToList();

        properties.ShouldNotContain("Password");
        properties.ShouldNotContain("Username");
        properties.ShouldContain(nameof(ElectronicInvoiceDto.LookupCode));
        properties.ShouldContain(nameof(ElectronicInvoiceDto.Status));
    }

    [Fact]
    public void A_Branch_Config_Never_Returns_Its_Password()
    {
        var properties = typeof(EInvoiceConfigDto).GetProperties().Select(p => p.Name).ToList();

        properties.ShouldNotContain("Password");
        properties.ShouldNotContain("PasswordCipher");
        properties.ShouldContain(nameof(EInvoiceConfigDto.HasPassword));
        new EasyInvoiceSettings(null, "http://x", "u", "very-secret", "t", "p", null, -1)
            .ToString().ShouldNotContain("very-secret");
    }

    [Fact]
    public void Branch_Configs_Are_Read_With_Tools_View_And_Changed_With_Tools_Manage()
    {
        ConfigPolicy(nameof(EInvoiceConfigAppService.GetListAsync)).ShouldBe(BlueDentalPermissions.Tools.View);
        ConfigPolicy(nameof(EInvoiceConfigAppService.GetAsync)).ShouldBe(BlueDentalPermissions.Tools.View);
        ConfigPolicy(nameof(EInvoiceConfigAppService.CreateAsync)).ShouldBe(BlueDentalPermissions.Tools.Manage);
        ConfigPolicy(nameof(EInvoiceConfigAppService.UpdateAsync)).ShouldBe(BlueDentalPermissions.Tools.Manage);
        ConfigPolicy(nameof(EInvoiceConfigAppService.DeleteAsync)).ShouldBe(BlueDentalPermissions.Tools.Manage);
    }

    [Fact]
    public void A_Slip_Has_Its_Own_Key_That_Cannot_Collide_With_A_Receipt()
    {
        var id = Guid.Parse("11111111-2222-3333-4444-555555555555");

        ElectronicInvoiceAppService.PlanIkeyOf(id).ShouldBe("bd-plan-11111111222233334444555555555555");
        ElectronicInvoiceAppService.PlanIkeyOf(id).ShouldNotBe(ElectronicInvoiceAppService.IkeyOf(id));
    }

    [Fact]
    public void One_Receipt_Always_Maps_To_The_Same_Provider_Key()
    {
        var id = Guid.Parse("11111111-2222-3333-4444-555555555555");

        ElectronicInvoiceAppService.IkeyOf(id).ShouldBe("bd-11111111222233334444555555555555");
        ElectronicInvoiceAppService.IkeyOf(id).Length.ShouldBeLessThanOrEqualTo(ElectronicInvoice.MaxIkeyLength);
    }

    [Fact]
    public void The_Http_Client_Is_The_Registered_Provider_Implementation()
    {
        typeof(IEasyInvoiceClient).IsAssignableFrom(typeof(HttpEasyInvoiceClient)).ShouldBeTrue();
        HttpEasyInvoiceClient.ImportInvoicePath.ShouldBe("/api/publish/importInvoice");
        HttpEasyInvoiceClient.ImportAndPublishPath.ShouldBe("/api/publish/importAndPublishInv");
    }

    private static string? ConfigPolicy(string method) =>
        typeof(EInvoiceConfigAppService).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()?.Policy;

    private static string? Policy(string method) =>
        typeof(ElectronicInvoiceAppService).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()?.Policy;
}
