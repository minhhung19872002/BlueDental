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
}
