using System.Reflection;
using BlueDental.Reporting;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.Reporting;

public class ReportAppServiceContractTests
{
    private readonly Type _serviceType = typeof(ReportAppService);
    private readonly Type _interfaceType = typeof(IReportAppService);

    [Fact]
    public void ReportAppService_Should_Implement_IReportAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void ReportAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void ReportAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetAppointmentSummaryAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetAppointmentSummaryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetRevenueReportAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetRevenueReportAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetExpenseLineItemsAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetExpenseLineItemsAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetAppointmentSummaryAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("GetAppointmentSummaryAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetRevenueReportAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("GetRevenueReportAsync").ShouldNotBeNull();
    }

    [Fact]
    public void GetExpenseLineItemsAsync_Should_Exist_On_Service()
    {
        _serviceType.GetMethod("GetExpenseLineItemsAsync").ShouldNotBeNull();
    }
}
