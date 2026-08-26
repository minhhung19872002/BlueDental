using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.Operations.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations;

/// <summary>
/// The Vận hành report sub-tabs. Read-only, one endpoint per screen.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/operations/reports")]
public sealed class OperationReportController(IOperationsReportAppService service)
    : BlueDentalController
{
    [HttpGet("work-log")]
    public Task<WorkLogResultDto> GetWorkLogAsync(
        [FromQuery] WorkLogInput input) => service.GetWorkLogAsync(input);

    [HttpGet("untreated-diagnoses")]
    public Task<PagedResultDto<UntreatedDiagnosisRowDto>> GetUntreatedDiagnosesAsync(
        [FromQuery] StaffScopedReportInput input) => service.GetUntreatedDiagnosesAsync(input);

    [HttpGet("consultant-summary")]
    public Task<PagedResultDto<ConsultantSummaryRowDto>> GetConsultantSummaryAsync(
        [FromQuery] StaffScopedReportInput input) => service.GetConsultantSummaryAsync(input);

    [HttpGet("invoices")]
    public Task<PagedResultDto<InvoiceReportRowDto>> GetInvoicesAsync(
        [FromQuery] InvoiceReportInput input) => service.GetInvoicesAsync(input);

    [HttpGet("service-completion")]
    public Task<ServiceCompletionResultDto> GetServiceCompletionAsync(
        [FromQuery] ServiceCompletionInput input) => service.GetServiceCompletionAsync(input);

    [HttpGet("sales-access")]
    public Task<SalesAccessResultDto> GetSalesAccessAsync(
        [FromQuery] SalesAccessInput input) => service.GetSalesAccessAsync(input);
}
