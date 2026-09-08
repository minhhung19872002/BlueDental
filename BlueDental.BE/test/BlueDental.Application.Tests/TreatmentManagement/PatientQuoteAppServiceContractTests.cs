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
    /// A quote stores the set, the order and the ticks — never a copy of a
    /// price. Reading the money off the consulting lines each time is what keeps
    /// a corrected price from going stale on a quote, so a price field creeping
    /// onto this DTO is a regression worth failing on.
    /// </summary>
    [Fact]
    public void PatientQuoteLineDto_Should_Carry_Only_The_Line_Its_Order_And_Its_Tick()
    {
        var names = Array.ConvertAll(
            typeof(PatientQuoteLineDto).GetProperties(),
            property => property.Name);

        names.ShouldBe(new[] { "AdviseId", "IsSelected", "SortOrder" }, ignoreOrder: true);
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
