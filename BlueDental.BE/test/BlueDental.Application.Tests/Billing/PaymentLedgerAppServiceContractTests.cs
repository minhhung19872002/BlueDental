using System.Reflection;
using BlueDental.Billing;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Billing;

/// <summary>
/// Tài chính → Thanh toán is read-only over payment receipts: Xem lists them,
/// Xuất file exports them, and nothing on the contract writes.
/// </summary>
public class PaymentLedgerAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PaymentLedgerAppService);

    [Fact]
    public void Should_Implement_Contract_And_Derive_From_BlueDentalAppService()
    {
        typeof(IPaymentLedgerAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        // The shared base binds the localization resource (R-525).
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.Payment.Read)]
    [InlineData("ExportAsync", BlueDentalAbilityPermissions.Payment.Export)]
    public void Each_Method_Should_Require_Its_Payment_Permission(string method, string permission)
    {
        _serviceType.GetMethod(method)!
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }

    [Fact]
    public void Contract_Should_Only_Read()
    {
        typeof(IPaymentLedgerAppService).GetMethods()
            .Select(m => m.Name)
            .ShouldBe(["GetListAsync", "ExportAsync"], ignoreOrder: true);
    }
}
