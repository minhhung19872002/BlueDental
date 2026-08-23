using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Finance;

/// <summary>
/// Quản lý thu chi — receipts and payments with an approval step on expenses.
/// </summary>
[Authorize]
public class SalesEntryAppService : ApplicationService, ISalesEntryAppService
{
    private readonly IRepository<SalesEntry, Guid> _repository;
    private readonly IRepository<CashflowCategory, Guid> _categoryRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public SalesEntryAppService(
        IRepository<SalesEntry, Guid> repository,
        IRepository<CashflowCategory, Guid> categoryRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _categoryRepository = categoryRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    public async Task<PagedResultDto<SalesEntryDto>> GetListAsync(GetSalesEntryListInput input)
    {
        await CheckReadPermissionAsync(input.Type);
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.EntryDate)
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var categoryNames = await GetCategoryNamesAsync(items);
        var staffNames = await GetStaffNamesAsync(items);
        return new PagedResultDto<SalesEntryDto>(
            totalCount,
            items.Select(x => MapToDto(x, categoryNames, staffNames)).ToList());
    }

    public async Task<SalesStatsDto> GetStatsAsync(GetSalesEntryListInput input)
    {
        await CheckReadPermissionAsync(input.Type);
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

    public async Task<SalesEntryDto> GetAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await CheckReadPermissionAsync(entry.Type);
        return MapToDto(entry, await GetCategoryNamesAsync([entry]), await GetStaffNamesAsync([entry]));
    }

    public async Task<SalesEntryDto> CreateAsync(CreateSalesEntryDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await AuthorizationService.CheckAsync(PermissionFor(input.Type, BlueDentalAbilities.Actions.Create));
        var code = await GenerateCodeAsync(input.ClinicBranchId, input.Type);

        var entry = SalesEntry.Record(
            GuidGenerator.Create(),
            input.ClinicBranchId,
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
        return MapToDto(entry, await GetCategoryNamesAsync([entry]), await GetStaffNamesAsync([entry]));
    }

    public async Task<SalesEntryDto> UpdateAsync(Guid id, UpdateSalesEntryDto input)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await AuthorizationService.CheckAsync(PermissionFor(entry.Type, BlueDentalAbilities.Actions.Update));

        entry.UpdateDetails(
            input.CategoryId,
            input.Amount,
            input.Channel,
            input.Description,
            input.EntryDate,
            input.PatientId);

        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry, await GetCategoryNamesAsync([entry]), await GetStaffNamesAsync([entry]));
    }

    [Authorize(BlueDentalAbilityPermissions.ReportCost.Approve)]
    public async Task<SalesEntryDto> ApproveAsync(Guid id, ApproveSalesEntryInput input)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        entry.Approve(input.StaffId);
        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry, await GetCategoryNamesAsync([entry]), await GetStaffNamesAsync([entry]));
    }

    [Authorize(BlueDentalAbilityPermissions.ReportCost.Approve)]
    public async Task<SalesEntryDto> RejectAsync(Guid id, RejectSalesEntryInput input)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        entry.Reject(input.StaffId, input.Reason);
        await _repository.UpdateAsync(entry, autoSave: true);
        return MapToDto(entry, await GetCategoryNamesAsync([entry]), await GetStaffNamesAsync([entry]));
    }

    public async Task DeleteAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await AuthorizationService.CheckAsync(PermissionFor(entry.Type, BlueDentalAbilities.Actions.Delete));
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>
    /// The reference guards receipts with <c>reportIncome</c> and payments with
    /// <c>reportCost</c>. One endpoint serves both, so the subject is resolved
    /// from the voucher type.
    /// </summary>
    private static string PermissionFor(SalesEntryType type, string action) =>
        BlueDentalAbilities.Permission(
            type == SalesEntryType.Income
                ? BlueDentalAbilities.Subjects.ReportIncome
                : BlueDentalAbilities.Subjects.ReportCost,
            action);

    /// <summary>
    /// A list that is not filtered by type needs both read permissions, since it
    /// returns receipts and payments together.
    /// </summary>
    private async Task CheckReadPermissionAsync(SalesEntryType? type)
    {
        if (type.HasValue)
        {
            await AuthorizationService.CheckAsync(PermissionFor(type.Value, BlueDentalAbilities.Actions.Read));
            return;
        }

        await AuthorizationService.CheckAsync(BlueDentalAbilityPermissions.ReportIncome.Read);
        await AuthorizationService.CheckAsync(BlueDentalAbilityPermissions.ReportCost.Read);
    }

    private async Task<IQueryable<SalesEntry>> BuildQueryAsync(GetSalesEntryListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
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

    private async Task<Dictionary<Guid, string>> GetCategoryNamesAsync(
        IReadOnlyCollection<SalesEntry> entries)
    {
        var ids = entries.Select(x => x.CategoryId).Distinct().ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _categoryRepository.GetQueryableAsync();
        return query
            .Where(c => ids.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);
    }

    /// <summary>
    /// "Nhân viên thu" is an identity user, so the name is resolved here rather
    /// than denormalised onto the voucher.
    /// </summary>
    private async Task<Dictionary<Guid, string>> GetStaffNamesAsync(
        IReadOnlyCollection<SalesEntry> entries)
    {
        var ids = entries.Select(x => x.StaffId).Distinct().ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private static SalesEntryDto MapToDto(
        SalesEntry entity,
        IReadOnlyDictionary<Guid, string> categoryNames,
        IReadOnlyDictionary<Guid, string> staffNames) => new()
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
        CategoryName = categoryNames.TryGetValue(entity.CategoryId, out var categoryName) ? categoryName : null,
        StaffName = staffNames.TryGetValue(entity.StaffId, out var staffName) ? staffName : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
