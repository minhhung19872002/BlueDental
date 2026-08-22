using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Reporting;

public interface IReportAppService : IApplicationService
{
    Task<AppointmentSummaryReportDto> GetAppointmentSummaryAsync(ReportQueryDto input);
    Task<RevenueReportDto> GetRevenueReportAsync(ReportQueryDto input);
    Task<ExpenseReportResultDto> GetExpenseLineItemsAsync(ReportQueryDto input);
}
