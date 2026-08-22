using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Finance;

/// <summary>Quản lý thu chi.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/sales")]
public sealed class SalesEntryController(ISalesEntryAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<SalesEntryDto>> GetListAsync([FromQuery] GetSalesEntryListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<SalesStatsDto> GetStatsAsync([FromQuery] GetSalesEntryListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<SalesEntryDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<SalesEntryDto> CreateAsync([FromBody] CreateSalesEntryDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<SalesEntryDto> UpdateAsync(Guid id, [FromBody] UpdateSalesEntryDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/approve")]
    public Task<SalesEntryDto> ApproveAsync(Guid id, [FromBody] ApproveSalesEntryInput input) =>
        service.ApproveAsync(id, input);

    [HttpPost("{id:guid}/reject")]
    public Task<SalesEntryDto> RejectAsync(Guid id, [FromBody] RejectSalesEntryInput input) =>
        service.RejectAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Danh mục thu chi / luân chuyển.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/cashflow-categories")]
public sealed class CashflowCategoryController(ICashflowCategoryAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<CashflowCategoryDto>> GetListAsync(
        [FromQuery] GetCashflowCategoryListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<CashflowCategoryDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<CashflowCategoryDto> CreateAsync([FromBody] CreateCashflowCategoryDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<CashflowCategoryDto> UpdateAsync(Guid id, [FromBody] UpdateCashflowCategoryDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Luân chuyển dòng tiền.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/cash-management")]
public sealed class CashManagementController(ICashManagementAppService service) : BlueDentalController
{
    [HttpGet("balance")]
    public Task<CashBalanceDto> GetBalanceAsync([FromQuery] Guid clinicBranchId) =>
        service.GetBalanceAsync(clinicBranchId);

    [HttpGet("cashflow-overview")]
    public Task<CashflowOverviewDto> GetOverviewAsync([FromQuery] GetCashflowEntryListInput input) =>
        service.GetOverviewAsync(input);

    [HttpGet("cashflow-entries")]
    public Task<PagedResultDto<CashflowEntryDto>> GetEntriesAsync(
        [FromQuery] GetCashflowEntryListInput input) => service.GetEntriesAsync(input);

    [HttpPost("cashflow-entries")]
    public Task<CashflowEntryDto> CreateEntryAsync([FromBody] CreateCashflowEntryDto input) =>
        service.CreateEntryAsync(input);

    [HttpDelete("cashflow-entries/{id:guid}")]
    public Task DeleteEntryAsync(Guid id) => service.DeleteEntryAsync(id);
}
