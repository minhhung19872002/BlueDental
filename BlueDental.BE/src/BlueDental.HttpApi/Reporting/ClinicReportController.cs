using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Reporting;

/// <summary>Báo cáo doanh số và kết quả kinh doanh.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/clinic-reports")]
public sealed class ClinicReportController(IClinicReportAppService service) : BlueDentalController
{
    [HttpGet("payment-stat")]
    public Task<PaymentStatSummaryDto> GetPaymentStatAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetPaymentStatAsync(input);

    [HttpGet("patient-history")]
    public Task<List<PatientHistoryRowDto>> GetPatientHistoryAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetPatientHistoryAsync(input);

    [HttpGet("business-result")]
    public Task<BusinessResultDto> GetBusinessResultAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetBusinessResultAsync(input);

    [HttpGet("patient-history/excel")]
    public async Task<IActionResult> ExportPatientHistoryAsync(
        [FromQuery] ClinicReportQueryDto input) =>
        Excel(await service.ExportPatientHistoryAsync(input), "doanh-so");

    [HttpGet("business-result/excel")]
    public async Task<IActionResult> ExportBusinessResultAsync(
        [FromQuery] ClinicReportQueryDto input) =>
        Excel(await service.ExportBusinessResultAsync(input), "ket-qua-kinh-doanh");

    [HttpGet("service-lines")]
    public Task<List<ServiceLineDto>> GetServiceLinesAsync(
        [FromQuery] ClinicReportQueryWithDoctorDto input) => service.GetServiceLinesAsync(input);

    [HttpGet("payment-lines")]
    public Task<List<PaymentLineDto>> GetPaymentLinesAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetPaymentLinesAsync(input);

    [HttpGet("refund-lines")]
    public Task<List<RefundLineDto>> GetRefundLinesAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetRefundLinesAsync(input);

    [HttpGet("debt-lines")]
    public Task<List<DebtLineDto>> GetDebtLinesAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetDebtLinesAsync(input);

    [HttpGet("prepaid-lines")]
    public Task<List<PrepaidLineDto>> GetPrepaidLinesAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetPrepaidLinesAsync(input);

    [HttpGet("sales-summary")]
    public Task<SalesSummaryDto> GetSalesSummaryAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetSalesSummaryAsync(input);

    [HttpGet("overview-stats")]
    public Task<OverviewStatsDto> GetOverviewStatsAsync(
        [FromQuery] ClinicReportQueryDto input) => service.GetOverviewStatsAsync(input);
}
