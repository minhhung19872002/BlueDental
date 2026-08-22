using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Reporting;

[RemoteService]
[Authorize]
[Route("api/v1/app/reports")]
public sealed class ReportController(IReportAppService service) : BlueDentalController
{
    [HttpGet("appointments/summary")]
    public Task<AppointmentSummaryReportDto> GetAppointmentSummaryAsync(
        [FromQuery] ReportQueryDto input) => service.GetAppointmentSummaryAsync(input);

    [HttpGet("billing/revenue")]
    public Task<RevenueReportDto> GetRevenueReportAsync(
        [FromQuery] ReportQueryDto input) => service.GetRevenueReportAsync(input);

    [HttpGet("expense/line-items")]
    public Task<ExpenseReportResultDto> GetExpenseLineItemsAsync(
        [FromQuery] ReportQueryDto input) => service.GetExpenseLineItemsAsync(input);
}
