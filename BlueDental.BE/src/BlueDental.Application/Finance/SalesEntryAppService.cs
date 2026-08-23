using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Finance;

/// <summary>
/// Quản lý thu chi — receipts and payments with an approval step on expenses.
/// </summary>
[Authorize(BlueDentalPermissions.Finance.Default)]
public class SalesEntryAppService : ApplicationService, ISalesEntryAppService
{
    [Authorize]
    public async Task<byte[]> ExportAsync(GetSalesEntryListInput input)
    {
        // Both income and expense need the ability that guards their own list, so
        // the export reuses GetListAsync rather than querying around it.
        var page = await GetListAsync(new GetSalesEntryListInput
        {
            ClinicBranchId = input.ClinicBranchId,
            Type = input.Type,
            FromDate = input.FromDate,
            ToDate = input.ToDate,
            Approved = input.Approved,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "Thu chi",
            "Quản lý thu chi",
            new List<ExcelColumn<SalesEntryDto>>
            {
                new("Ngày", row => row.EntryDate, 14),
                new("Số phiếu", row => row.Code, 16),
                new("Loại", row => row.Type == SalesEntryType.Income ? "Thu" : "Chi", 10),
                new("Mục thu chi", row => row.CategoryName, 24),
                new("Nội dung", row => row.Description, 40),
                new("Khách hàng", row => row.PatientName, 24),
                new("Nhân viên", row => row.StaffName, 22),
                new("Số tiền", row => row.Amount, 18),
                new("Đã duyệt", row => row.CountsTowardsCashflow ? "Có" : "Chưa", 12)
            },
            page.Items);
    }

    private readonly IRepository<SalesEntry, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public SalesEntryAppService(
        IRepository<SalesEntry, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<PagedResultDto<SalesEntryDto>> GetListAsync(GetSalesEntryListInput input)
    {
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.EntryDate)
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<SalesEntryDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<SalesStatsDto> GetStatsAsync(GetSalesEntryListInput input)
    {
        var query = await BuildQueryAsync(input);
        var items = query.ToList();

        var counted = items.Where(x => x.CountsTowardsCashflow).ToList();
        var income = counted.Where(x => x.Type == SalesEntryType.Income).ToList();
        var expense = counted.Where(x => x.Type == SalesEntryType.Expense).ToList();
        var pending = items
            .Where(x => x.Type == SalesEntryType.Expense &&
                        x.ApprovalStatus == SalesApprovalStatus.Pending)
            .ToList();

        return new SalesStatsDto
        {
            TotalIncome = income.Sum(x => x.Amount),
            TotalExpense = expense.Sum(x => x.Amount),
            Net = counted.Sum(x => x.SignedAmount),
            PendingExpense = pending.Sum(x => x.Amount),
            PendingExpenseCount = pending.Count,
            IncomeByCash = income.Where(x => x.Channel == PaymentChannel.Cash).Sum(x => x.Amount),
            IncomeByBanking = income.Where(x => x.Channel == PaymentChannel.Banking).Sum(x => x.Amount),
            ExpenseByCash = expense.Where(x => x.Channel == PaymentChannel.Cash).Sum(x => x.Amount),
            ExpenseByBanking = expense.Where(x => x.Channel == PaymentChannel.Banking).Sum(x => x.Amount)
        };
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<SalesEntryDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> CreateAsync(CreateSalesEntryDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var code = await GenerateCodeAsync(clinicBranchId, input.Type);

        var entry = SalesEntry.Record(
            GuidGenerator.Create(),
            clinicBranchId,
            code,
            input.Type,
            input.CategoryId,
            input.StaffId,
            input.Amount,
            input.Channel,
            input.Description,
            input.EntryDate,
            input.PatientId);

        await _repository.InsertAsync(entry, autoSave: true);
        return MapToDto(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> UpdateAsync(Guid id, UpdateSalesEntryDto input)
    {
        var entry = await _repository.GetAsync(id);

        entry.UpdateDetails(
            input.CategoryId,
            input.Amount,
            input.Channel,
            input.Description,
            input.EntryDate,
            input.PatientId);

        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> ApproveAsync(Guid id, ApproveSalesEntryInput input)
    {
        var entry = await _repository.GetAsync(id);
        entry.Approve(input.StaffId);
        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> RejectAsync(Guid id, RejectSalesEntryInput input)
    {
        var entry = await _repository.GetAsync(id);
        entry.Reject(input.StaffId, input.Reason);
        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<IQueryable<SalesEntry>> BuildQueryAsync(GetSalesEntryListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
        if (input.Type.HasValue)
            query = query.Where(x => x.Type == input.Type.Value);
        if (input.CategoryId.HasValue)
            query = query.Where(x => x.CategoryId == input.CategoryId.Value);
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.StaffId.HasValue)
            query = query.Where(x => x.StaffId == input.StaffId.Value);
        if (input.Channel.HasValue)
            query = query.Where(x => x.Channel == input.Channel.Value);
        if (input.FromDate.HasValue)
            query = query.Where(x => x.EntryDate >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.EntryDate <= input.ToDate.Value);

        if (input.Approved.HasValue)
        {
            query = input.Approved.Value
                ? query.Where(x => x.ApprovalStatus == SalesApprovalStatus.Approved)
                : query.Where(x => x.ApprovalStatus == SalesApprovalStatus.Pending);
        }

        return query;
    }

    /// <summary>Sequential per-branch, per-year code — <c>PT26-0001</c> / <c>PC26-0001</c>.</summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId, SalesEntryType type)
    {
        var year = Clock.Now.Year;
        var prefix = type == SalesEntryType.Income ? "PT" : "PC";
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x =>
            x.ClinicBranchId == clinicBranchId &&
            x.Type == type &&
            x.CreationTime.Year == year) + 1;

        return $"{prefix}{year % 100:D2}-{sequence:D4}";
    }

    private static SalesEntryDto MapToDto(SalesEntry entity) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Code = entity.Code,
        Type = entity.Type,
        CategoryId = entity.CategoryId,
        PatientId = entity.PatientId,
        StaffId = entity.StaffId,
        Amount = entity.Amount,
        Channel = entity.Channel,
        Description = entity.Description,
        EntryDate = entity.EntryDate,
        ApprovalStatus = entity.ApprovalStatus,
        ApprovedByStaffId = entity.ApprovedByStaffId,
        ApprovedAt = entity.ApprovedAt,
        RejectionReason = entity.RejectionReason,
        CountsTowardsCashflow = entity.CountsTowardsCashflow,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
