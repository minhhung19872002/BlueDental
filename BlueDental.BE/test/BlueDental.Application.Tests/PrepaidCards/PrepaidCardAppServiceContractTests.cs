using System.Linq;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.PrepaidCards;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.PrepaidCards;

/// <summary>
/// Each Thẻ trả trước endpoint names the prepaidCard leaf it needs, so the
/// Phân quyền tab's boxes are the ones the server checks. The payment
/// dialog's card picker is the exception: it is part of taking a payment.
/// </summary>
public class PrepaidCardAppServiceContractTests
{
    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IPrepaidCardAppService).IsAssignableFrom(typeof(PrepaidCardAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(PrepaidCardAppService)).ShouldBeTrue();
    }

    [Fact]
    public void Every_Interface_Method_Names_A_Permission()
    {
        foreach (var method in typeof(IPrepaidCardAppService).GetMethods())
        {
            typeof(PrepaidCardAppService).GetMethod(method.Name)!
                .GetCustomAttribute<AuthorizeAttribute>()?.Policy
                .ShouldNotBeNullOrEmpty($"{method.Name} has no permission");
        }
    }

    [Theory]
    [InlineData("GetTypeListAsync", BlueDentalAbilityPermissions.PrepaidCard.Read)]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.PrepaidCard.Read)]
    [InlineData("GetSummaryAsync", BlueDentalAbilityPermissions.PrepaidCard.Read)]
    [InlineData("GetAsync", BlueDentalAbilityPermissions.PrepaidCard.Read)]
    [InlineData("CreateTypeAsync", BlueDentalAbilityPermissions.PrepaidCard.Create)]
    [InlineData("SellAsync", BlueDentalAbilityPermissions.PrepaidCard.Create)]
    [InlineData("UpdateTypeAsync", BlueDentalAbilityPermissions.PrepaidCard.Update)]
    [InlineData("TopupAsync", BlueDentalAbilityPermissions.PrepaidCard.Update)]
    [InlineData("SetMembersAsync", BlueDentalAbilityPermissions.PrepaidCard.Update)]
    [InlineData("LockAsync", BlueDentalAbilityPermissions.PrepaidCard.Update)]
    [InlineData("UnlockAsync", BlueDentalAbilityPermissions.PrepaidCard.Update)]
    [InlineData("DeleteTypeAsync", BlueDentalAbilityPermissions.PrepaidCard.Delete)]
    [InlineData("CancelAsync", BlueDentalAbilityPermissions.PrepaidCard.Delete)]
    [InlineData("GetUsableAsync", BlueDentalAbilityPermissions.Payment.Create)]
    public void Each_Method_Names_Its_Leaf(string method, string permission)
    {
        typeof(PrepaidCardAppService).GetMethods().Single(m => m.Name == method)
            .GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(permission);
    }
}
