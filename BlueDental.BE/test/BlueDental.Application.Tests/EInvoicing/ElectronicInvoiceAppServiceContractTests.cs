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
        Policy(nameof(ElectronicInvoiceAppService.GetListAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        Policy(nameof(ElectronicInvoiceAppService.SyncAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
        Policy(nameof(ElectronicInvoiceAppService.GetPdfAsync)).ShouldBe(BlueDentalAbilityPermissions.Payment.Read);
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
    }

    private static string? Policy(string method) =>
        typeof(ElectronicInvoiceAppService).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()?.Policy;
}
