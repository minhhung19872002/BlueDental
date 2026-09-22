using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Organizations;
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
[Authorize(BlueDentalPermissions.Finance.Default)]
public class CashManagementAppService : ApplicationService, ICashManagementAppService
{
    private readonly IRepository<CashflowEntry, Guid> _repository;
    private readonly IRepository<CashflowCategory, Guid> _categoryRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IIdentityUserRepository _userRepository;

    public CashManagementAppService(
        IRepository<CashflowEntry, Guid> repository,
        IRepository<CashflowCategory, Guid> categoryRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        ICurrentClinicBranchResolver branchResolver,
        IIdentityUserRepository userRepository)
    {
        _repository = repository;
        _categoryRepository = categoryRepository;
        _paymentRepository = paymentRepository;
        _branchResolver = branchResolver;
        _userRepository = userRepository;
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<CashBalanceDto> GetBalanceAsync(Guid clinicBranchId)
    {
        var query = await _repository.GetQueryableAsync();
        var entries = query.Where(x => x.ClinicBranchId == clinicBranchId).ToList();

        return BuildBalance(entries, await GetPatientMoneyAsync(clinicBranchId));
    }

    [Authorize(BlueDentalPermissions.Finance.View)]
    public async Task<CashflowOverviewDto> GetOverviewAsync(GetCashflowEntryListInput input)
    {
        var query = await BuildQueryAsync(input);
        var entries = query.ToList();

        var categoryNames = await GetCategoryNamesAsync(entries);
        var patientMoney = await GetPatientMoneyAsync(_branchResolver.GetRequiredClinicBranchId());

        return new CashflowOverviewDto
        {
            Balance = BuildBalance(entries, patientMoney),
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

    [Authorize(BlueDentalPermissions.Finance.View)]
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

        var categories = await GetCategoriesAsync(items);
        var staffNames = await GetStaffNamesAsync(items);

        return new PagedResultDto<CashflowEntryDto>(
            totalCount,
            items.Select(x => MapToDto(x, categories, staffNames)).ToList());
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<CashflowEntryDto> CreateEntryAsync(CreateCashflowEntryDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var id = GuidGenerator.Create();

        var entry = input.TransactionType switch
        {
            CashTransactionType.Deposit => CashflowEntry.Deposit(
                id, clinicBranchId,
                RequireHolding(input.ToHolding, "toHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            CashTransactionType.Withdraw => CashflowEntry.Withdraw(
                id, clinicBranchId,
                RequireHolding(input.FromHolding, "fromHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            CashTransactionType.Transfer => CashflowEntry.Transfer(
                id, clinicBranchId,
                RequireHolding(input.FromHolding, "fromHolding"),
                RequireHolding(input.ToHolding, "toHolding"),
                input.Amount, input.CreatedByStaffId, input.EntryDate, input.CategoryId, input.Note),

            _ => throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.CashflowEntryNotFound,
                $"Unsupported cash transaction type {input.TransactionType}.")
        };

        await _repository.InsertAsync(entry, autoSave: true);

        var single = new[] { entry };
        return MapToDto(entry, await GetCategoriesAsync(single), await GetStaffNamesAsync(single));
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<CashflowEntryDto> UpdateEntryAsync(Guid id, UpdateCashflowEntryDto input)
    {
        var entry = await GetScopedEntryAsync(id);

        entry.Revise(input.FromHolding, input.ToHolding, input.Amount, input.CategoryId, input.Note);

        await _repository.UpdateAsync(entry, autoSave: true);

        var single = new[] { entry };
        return MapToDto(entry, await GetCategoriesAsync(single), await GetStaffNamesAsync(single));
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task DeleteEntryAsync(Guid id)
    {
        var entry = await GetScopedEntryAsync(id);
        await _repository.DeleteAsync(entry, autoSave: true);
    }

    /// <summary>An entry of another branch is invisible, not forbidden — same as the list.</summary>
    private async Task<CashflowEntry> GetScopedEntryAsync(Guid id)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var entry = await _repository.FindAsync(id);

        if (entry is null || entry.ClinicBranchId != clinicBranchId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Finance.CashflowEntryNotFound)
                .WithData("id", id);
        }

        return entry;
    }

    private async Task<IQueryable<CashflowEntry>> BuildQueryAsync(GetCashflowEntryListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
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
        var categories = await GetCategoriesAsync(entries);
        return categories.ToDictionary(c => c.Key, c => c.Value.Name);
    }

    /// <summary>Name and colour of every category the entries point at (deleted ones included, so old rows keep their label).</summary>
    private async Task<Dictionary<Guid, (string Name, string? Color)>> GetCategoriesAsync(
        IReadOnlyCollection<CashflowEntry> entries)
    {
        var ids = entries
            .Where(x => x.CategoryId.HasValue)
            .Select(x => x.CategoryId!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, (string, string?)>();
        }

        var query = await _categoryRepository.GetQueryableAsync();
        return query
            .Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.Name, c.ColorCode })
            .ToDictionary(c => c.Id, c => (c.Name, c.ColorCode));
    }

    /// <summary>
    /// "Người tạo" — cashflow entries carry the identity user id of whoever
    /// booked them, so the display name comes from ABP Identity, same as the
    /// sales ledger.
    /// </summary>
    private async Task<Dictionary<Guid, string>> GetStaffNamesAsync(
        IReadOnlyCollection<CashflowEntry> entries)
    {
        var ids = entries
            .Select(x => x.CreatedByStaffId)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    /// <summary>
    /// The two summary lines under the tiles — "Doanh thu dịch vụ" and "Cà thẻ
    /// (đối soát)" — start from the patient ledger, not from the cash ledger.
    /// ASSUMPTION (UNKNOWN_REFERENCE_BEHAVIOR, the reference showed 0 for both
    /// during the survey): service revenue is every treatment payment net of
    /// refunds, and card-pending is every card payment net of card refunds plus
    /// whatever was deposited into the <see cref="CashHolding.Card"/> holding.
    /// </summary>
    private async Task<(decimal ServiceRevenue, decimal CardPending)> GetPatientMoneyAsync(Guid clinicBranchId)
    {
        var query = await _paymentRepository.GetQueryableAsync();
        var payments = query
            .Where(x => x.ClinicBranchId == clinicBranchId)
            .Select(x => new { x.Kind, x.Method, x.TreatmentPlanId, x.Amount })
            .ToList();

        var serviceRevenue = payments
            .Where(x => x.Kind != PatientPaymentKind.Prepaid && x.TreatmentPlanId != null)
            .Sum(x => x.Kind == PatientPaymentKind.Refund ? -x.Amount : x.Amount);

        var cardPending = payments
            .Where(x => x.Method == PaymentMethodKind.Card)
            .Sum(x => x.Kind == PatientPaymentKind.Refund ? -x.Amount : x.Amount);

        return (serviceRevenue, cardPending);
    }

    private static CashBalanceDto BuildBalance(
        IReadOnlyCollection<CashflowEntry> entries,
        (decimal ServiceRevenue, decimal CardPending) patientMoney)
    {
        var cash = entries.Sum(x => x.EffectOn(CashHolding.Cash));
        var bank = entries.Sum(x => x.EffectOn(CashHolding.Bank));
        var prepaid = entries.Sum(x => x.EffectOn(CashHolding.CustomerPrepaid));
        var card = entries.Sum(x => x.EffectOn(CashHolding.Card));

        return new CashBalanceDto
        {
            Cash = cash,
            Bank = bank,
            CustomerPrepaid = prepaid,
            // "Tổng Tiền" is what the clinic can spend: money held for customers
            // and card takings the bank has not settled are both excluded.
            Total = cash + bank,
            ServiceRevenue = patientMoney.ServiceRevenue,
            CardPending = patientMoney.CardPending + card
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
        IReadOnlyDictionary<Guid, (string Name, string? Color)> categories,
        IReadOnlyDictionary<Guid, string> staffNames) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        TransactionType = entity.TransactionType,
        FromHolding = entity.FromHolding,
        ToHolding = entity.ToHolding,
        Amount = entity.Amount,
        CategoryId = entity.CategoryId,
        CategoryName = entity.CategoryId.HasValue && categories.TryGetValue(entity.CategoryId.Value, out var category)
            ? category.Name
            : null,
        CategoryColor = entity.CategoryId.HasValue && categories.TryGetValue(entity.CategoryId.Value, out var colored)
            ? colored.Color
            : null,
        CreatedByStaffId = entity.CreatedByStaffId,
        CreatedByStaffName = staffNames.TryGetValue(entity.CreatedByStaffId, out var staffName)
            ? staffName
            : null,
        EntryDate = entity.EntryDate,
        Note = entity.Note,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
