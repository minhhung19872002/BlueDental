using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Operations.Reports;

/// <summary>
/// The read-only half of Vận hành: the sub-tabs that report on the clinic
/// rather than hold articles.
///
/// Every one of these projects from tables another feature owns — diagnoses,
/// consulting lines, treatment services, invoices — so nothing here writes, and
/// each is scoped to the branches the caller may see.
/// </summary>
public interface IOperationsReportAppService : IApplicationService
{
    /// <summary>Quản trị vận hành → Báo cáo.</summary>
    Task<WorkLogResultDto> GetWorkLogAsync(WorkLogInput input);

    /// <summary>Quản trị vận hành → Chẩn đoán chưa điều trị.</summary>
    Task<PagedResultDto<UntreatedDiagnosisRowDto>> GetUntreatedDiagnosesAsync(
        StaffScopedReportInput input);

    /// <summary>Khối tài chính → Khách hàng phát sinh.</summary>
    Task<PagedResultDto<ConsultantSummaryRowDto>> GetConsultantSummaryAsync(
        StaffScopedReportInput input);

    /// <summary>Khối tài chính → Hóa đơn.</summary>
    Task<PagedResultDto<InvoiceReportRowDto>> GetInvoicesAsync(InvoiceReportInput input);

    /// <summary>Khối tài chính → Hoàn thành theo dịch vụ.</summary>
    Task<ServiceCompletionResultDto> GetServiceCompletionAsync(ServiceCompletionInput input);

    /// <summary>Khối điều trị / Khối tài chính → Truy cập.</summary>
    Task<SalesAccessResultDto> GetSalesAccessAsync(SalesAccessInput input);
}
