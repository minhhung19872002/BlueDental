using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Finance;

/// <summary>
/// Quản lý thu chi — reference: <c>/api/v1/sales</c> and <c>/api/v1/sales/stats</c>.
/// </summary>
public interface ISalesEntryAppService : IApplicationService
{
    Task<PagedResultDto<SalesEntryDto>> GetListAsync(GetSalesEntryListInput input);
    Task<SalesStatsDto> GetStatsAsync(GetSalesEntryListInput input);
    Task<SalesEntryDto> GetAsync(Guid id);
    Task<SalesEntryDto> CreateAsync(CreateSalesEntryDto input);
    Task<SalesEntryDto> UpdateAsync(Guid id, UpdateSalesEntryDto input);
    /// <summary>Reference: <c>PUT /sales/{id}/approve</c> with no body — the approver is the caller.</summary>
    Task<SalesEntryDto> ApproveAsync(Guid id);
    Task<SalesEntryDto> RejectAsync(Guid id, RejectSalesEntryInput input);
    Task DeleteAsync(Guid id);

    /// <summary>"BE:Common:ExportExcel" on the Quản lý thu chi tab.</summary>
    Task<byte[]> ExportAsync(GetSalesEntryListInput input);
}

/// <summary>
/// Danh mục thu chi / luân chuyển — reference permissions
/// <c>reportCashflowCategory</c> and <c>reportTransferCategory</c>.
/// </summary>
public interface ICashflowCategoryAppService : IApplicationService
{
    Task<PagedResultDto<CashflowCategoryDto>> GetListAsync(GetCashflowCategoryListInput input);
    Task<CashflowCategoryDto> GetAsync(Guid id);
    Task<CashflowCategoryDto> CreateAsync(CreateCashflowCategoryDto input);
    Task<CashflowCategoryDto> UpdateAsync(Guid id, UpdateCashflowCategoryDto input);
    Task DeleteAsync(Guid id);
}

/// <summary>
/// Luân chuyển dòng tiền — reference: <c>/api/v1/cash-management/*</c>.
/// </summary>
public interface ICashManagementAppService : IApplicationService
{
    Task<CashBalanceDto> GetBalanceAsync(Guid clinicBranchId);
    Task<CashflowOverviewDto> GetOverviewAsync(GetCashflowEntryListInput input);
    Task<PagedResultDto<CashflowEntryDto>> GetEntriesAsync(GetCashflowEntryListInput input);
    Task<CashflowEntryDto> CreateEntryAsync(CreateCashflowEntryDto input);
    Task<CashflowEntryDto> UpdateEntryAsync(Guid id, UpdateCashflowEntryDto input);
    Task DeleteEntryAsync(Guid id);
}
