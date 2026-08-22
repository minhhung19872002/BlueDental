using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Finance;

/// <summary>
/// Luân chuyển dòng tiền — deposits, withdrawals and transfers between the
/// clinic's holdings, plus the balance and overview panels.
/// </summary>
[Authorize]
public class CashManagementAppService : ApplicationService, ICashManagementAppService
{
    private readonly IRepository<CashflowEntry, Guid> _repository;
    private readonly IRepository<CashflowCategory, Guid> _categoryRepository;
    private readonly IIdentityUserRepository _userRepository;

    public CashManagementAppService(
        IRepository<CashflowEntry, Guid> repository,
        IRepository<CashflowCategory, Guid> categoryRepository,
        IIdentityUserRepository userRepository)
    {
        _repository = repository;
        _categoryRepository = categoryRepository;
        _userRepository = userRepository;
    }

    [Authorize(BlueDentalAbilityPermissions.ReportTransfer.Read)]
    public async Task<CashBalanceDto> GetBalanceAsync(Guid clinicBranchId)
    {
        var query = await _repository.GetQueryableAsync();
        var entries = query.Where(x => x.ClinicBranchId == clinicBranchId).ToList();

        return BuildBalance(entries);
    }

    [Authorize(BlueDentalAbilityPermissions.ReportTransfer.Read)]
    public async Task<CashflowOverviewDto> GetOverviewAsync(GetCashflowEntryListInput input)
    {
        var query = await BuildQueryAsync(input);
        var entries = query.ToList();

        var categoryNames = await GetCategoryNamesAsync(entries);

        return new CashflowOverviewDto
        {
            Balance = BuildBalance(entries),
            TotalDeposit = entries.Where(x => x.TransactionType == CashTransactionType.Deposit).Sum(x => x.Amount),
            TotalWithdraw = entries.Where(x => x.TransactionType == CashTransactionType.Withdraw).Sum(x => x.Amount),
            TotalTransfer = entries.Where(x => x.TransactionType == CashTransactionType.Transfer).Sum(x => x.Amount),
            EntryCount = entries.Count,
            ByCategory = entries
                .GroupBy(x => x.CategoryId)
                .Select(g => new CashflowCategoryTotalDto
                {
                    CategoryId = g.Key,
                    CategoryName = g.Key.HasValue && categoryNames.TryGetValue(g.Key.Value, out var name)
                        ? name
                        : null,
                    Amount = g.Sum(x => x.Amount),
                    EntryCount = g.Count()
                })
                .OrderByDescending(x => x.Amount)
                .ToList()
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportTransfer.Read)]
    public async Task<PagedResultDto<CashflowEntryDto>> GetEntriesAsync(GetCashflowEntryListInput input)
    {
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

        return new PagedResultDto<CashflowEntryDto>(
            totalCount,
            items.Select(x => MapToDto(x, categoryNames, staffNames)).ToList());
    }

    public async Task<CashflowEntryDto> CreateEntryAsync(CreateCashflowEntryDto input)
    {
        // The reference gives each cash operation its own action on reportTransfer.
        await AuthorizationService.CheckAsync(input.TransactionType switch
        {
            CashTransactionType.Deposit => BlueDentalAbilityPermissions.ReportTransfer.Deposit,
            CashTransactionType.Withdraw => BlueDentalAbilityPermissions.ReportTransfer.Withdraw,
            _ => BlueDentalAbilityPermissions.ReportTransfer.Transfer
        });

        var id = GuidGenerator.Create();

        var entry = input.TransactionType switch
        {
            CashTransactionType.Deposit => CashflowEntry.Deposit(
                id, input.ClinicBranchId,
                RequireHolding(input.ToHolding, "toHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            CashTransactionType.Withdraw => CashflowEntry.Withdraw(
                id, input.ClinicBranchId,
                RequireHolding(input.FromHolding, "fromHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            CashTransactionType.Transfer => CashflowEntry.Transfer(
                id, input.ClinicBranchId,
                RequireHolding(input.FromHolding, "fromHolding"),
                RequireHolding(input.ToHolding, "toHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            _ => throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.CashflowEntryNotFound,
                $"Unsupported cash transaction type {input.TransactionType}.")
        };

        await _repository.InsertAsync(entry, autoSave: true);
        return MapToDto(entry, new Dictionary<Guid, string>(), new Dictionary<Guid, string>());
    }

    [Authorize(BlueDentalAbilityPermissions.ReportTransfer.Delete)]
    public async Task DeleteEntryAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<IQueryable<CashflowEntry>> BuildQueryAsync(GetCashflowEntryListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.ClinicBranchId.HasValue)
            query = query.Where(x => x.ClinicBranchId == input.ClinicBranchId.Value);
        if (input.TransactionType.HasValue)
            query = query.Where(x => x.TransactionType == input.TransactionType.Value);
        if (input.CategoryId.HasValue)
            query = query.Where(x => x.CategoryId == input.CategoryId.Value);
        if (input.FromDate.HasValue)
            query = query.Where(x => x.EntryDate >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.EntryDate <= input.ToDate.Value);
        if (input.Holding.HasValue)
            query = query.Where(x =>
                x.FromHolding == input.Holding.Value || x.ToHolding == input.Holding.Value);

        return query;
    }

    private async Task<Dictionary<Guid, string>> GetCategoryNamesAsync(
        IReadOnlyCollection<CashflowEntry> entries)
    {
        var ids = entries
            .Where(x => x.CategoryId.HasValue)
            .Select(x => x.CategoryId!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _categoryRepository.GetQueryableAsync();
        return query
            .Where(c => ids.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);
    }

    private async Task<Dictionary<Guid, string>> GetStaffNamesAsync(
        IReadOnlyCollection<CashflowEntry> entries)
    {
        var ids = entries.Select(x => x.CreatedByStaffId).Distinct().ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private static CashBalanceDto BuildBalance(IReadOnlyCollection<CashflowEntry> entries)
    {
        var cash = entries.Sum(x => x.EffectOn(CashHolding.Cash));
        var bank = entries.Sum(x => x.EffectOn(CashHolding.Bank));
        var prepaid = entries.Sum(x => x.EffectOn(CashHolding.CustomerPrepaid));

        return new CashBalanceDto
        {
            Cash = cash,
            Bank = bank,
            CustomerPrepaid = prepaid,
            // "Tổng Tiền" is what the clinic owns: money held for customers is excluded.
            Total = cash + bank
        };
    }

    private static CashHolding RequireHolding(CashHolding? holding, string field)
    {
        return holding ?? throw new BusinessException(
            BlueDentalDomainErrorCodes.Finance.SameTransferHolding,
            $"'{field}' is required for this transaction type.");
    }

    private static CashflowEntryDto MapToDto(
        CashflowEntry entity,
        IReadOnlyDictionary<Guid, string> categoryNames,
        IReadOnlyDictionary<Guid, string> staffNames) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        TransactionType = entity.TransactionType,
        FromHolding = entity.FromHolding,
        ToHolding = entity.ToHolding,
        Amount = entity.Amount,
        CategoryId = entity.CategoryId,
        CategoryName = entity.CategoryId.HasValue && categoryNames.TryGetValue(entity.CategoryId.Value, out var name)
            ? name
            : null,
        CreatedByStaffId = entity.CreatedByStaffId,
        CreatedByStaffName = staffNames.TryGetValue(entity.CreatedByStaffId, out var staffName) ? staffName : null,
        EntryDate = entity.EntryDate,
        Note = entity.Note,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
