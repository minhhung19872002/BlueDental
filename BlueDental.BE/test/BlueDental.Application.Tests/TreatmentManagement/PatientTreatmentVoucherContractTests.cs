using System.Reflection;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

/// <summary>
/// BA item 24: the slip's open contract carries voucher ids, not a client-side
/// amount, and reads back the coupons it redeemed.
/// </summary>
public class PatientTreatmentVoucherContractTests
{
    [Fact]
    public void OpenTreatmentPlanDto_Should_Take_VoucherIds_Not_An_Amount()
    {
        var dto = typeof(OpenTreatmentPlanDto);
        dto.GetProperty("VoucherIds")!.PropertyType.ShouldBe(typeof(List<Guid>));
        dto.GetProperty("VoucherDiscountAmount").ShouldBeNull();
    }

    [Fact]
    public void TreatmentPlanSlipDto_Should_List_AppliedVouchers()
    {
        typeof(TreatmentPlanSlipDto).GetProperty("AppliedVouchers")!.PropertyType
            .ShouldBe(typeof(List<AppliedVoucherDto>));

        var applied = typeof(AppliedVoucherDto);
        foreach (var name in new[]
                 {
                     "VoucherId", "Code", "Name", "DiscountType", "DiscountValue",
                     "MaxDiscountAmount", "DiscountAmount"
                 })
        {
            applied.GetProperty(name).ShouldNotBeNull(name);
        }
    }

    [Fact]
    public void OpenAsync_Should_Require_Authorization()
    {
        typeof(PatientTreatmentAppService).GetMethod("OpenAsync")!
            .GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }
}
