using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Reporting;

/// <summary>Báo cáo Telesale (16.8) and Báo cáo CSKH (16.11) — BlueDental-local tabs of /report.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/clinic-reports")]
public sealed class CustomerReportController(
    ITelesaleReportAppService telesale,
    ICareReportAppService care) : BlueDentalController
{
    [HttpGet("telesale")]
    public Task<TelesaleReportDto> GetTelesaleAsync([FromQuery] ClinicReportQueryDto input) =>
        telesale.GetAsync(input);

    [HttpGet("telesale/excel")]
    public async Task<IActionResult> ExportTelesaleAsync([FromQuery] ClinicReportQueryDto input) =>
        Excel(await telesale.ExportAsync(input), "bao-cao-telesale");

    [HttpGet("customer-care")]
    public Task<CareReportDto> GetCareAsync([FromQuery] ClinicReportQueryDto input) =>
        care.GetAsync(input);

    [HttpGet("customer-care/excel")]
    public async Task<IActionResult> ExportCareAsync([FromQuery] ClinicReportQueryDto input) =>
        Excel(await care.ExportAsync(input), "bao-cao-cskh");
}
