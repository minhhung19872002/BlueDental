using System;
using System.Reflection;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class PatientQuoteAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PatientQuoteAppService);
    private readonly Type _interfaceType = typeof(IPatientQuoteAppService);

    [Fact]
    public void PatientQuoteAppService_Should_Implement_IPatientQuoteAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientQuoteAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientQuoteAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetListAsync")]
    [InlineData("CreateAsync")]
    [InlineData("DuplicateAsync")]
    [InlineData("UpdateAsync")]
    [InlineData("RepriceLineAsync")]
    [InlineData("DeleteAsync")]
    public void Every_Method_Should_Exist_On_Interface_And_Be_Authorized(string name)
    {
        _interfaceType.GetMethod(name).ShouldNotBeNull();
        _serviceType.GetMethod(name)
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull();
    }

    /// <summary>
    /// What a re-tick or a drag sends: the set, the order and the ticks. A
    /// quote's prices change only through <c>RepriceLineAsync</c>, so a price
    /// on this body would let a drag overwrite them.
    /// </summary>
    [Fact]
    public void PatientQuoteLineDto_Should_Carry_Only_The_Line_Its_Order_And_Its_Tick()
    {
        var names = Array.ConvertAll(
            typeof(PatientQuoteLineDto).GetProperties(),
            property => property.Name);

        names.ShouldBe(new[] { "AdviseId", "IsSelected", "SortOrder" }, ignoreOrder: true);
    }

    /// <summary>
    /// Phiếu tư vấn and every báo giá carry independent figures, so a quote
    /// reads back the price it holds for each line, worked out into amounts.
    /// </summary>
    [Fact]
    public void PatientQuoteDto_Should_Read_Back_Each_Lines_Own_Price()
    {
        typeof(PatientQuoteDto).GetProperty("Lines")!.PropertyType
            .ShouldBe(typeof(System.Collections.Generic.List<PatientQuoteLineReadDto>));

        foreach (var name in new[] { "Price", "Quantity", "DiscountType", "DiscountValue", "GrossAmount", "DiscountAmount", "EffectiveAmount" })
            typeof(PatientQuoteLineReadDto).GetProperty(name).ShouldNotBeNull();
    }

    [Fact]
    public void PatientQuoteDto_Should_Number_Itself_Per_Patient()
    {
        typeof(PatientQuoteDto).GetProperty("Ordinal").ShouldNotBeNull();
        typeof(PatientQuoteDto).GetProperty("PatientId").ShouldNotBeNull();
        typeof(PatientQuoteDto).GetProperty("ClinicBranchId").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateAsync_Should_Take_The_Whole_Set()
    {
        var parameters = _interfaceType.GetMethod("UpdateAsync").ShouldNotBeNull().GetParameters();

        parameters.Length.ShouldBe(2);
        parameters[0].ParameterType.ShouldBe(typeof(Guid));
        parameters[1].ParameterType.ShouldBe(typeof(UpdatePatientQuoteDto));
        typeof(UpdatePatientQuoteDto).GetProperty("Lines").ShouldNotBeNull();
    }
}
