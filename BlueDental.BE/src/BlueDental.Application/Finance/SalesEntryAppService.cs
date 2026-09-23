using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

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
            L["BE:Perm:IncomeExpenseMgmt"],
            new List<ExcelColumn<SalesEntryDto>>
            {
                new(L["BE:Col:Date"], row => row.EntryDate, 14),
                new(L["BE:Field:SlipNo"], row => row.Code, 16),
                new(L["BE:Field:Type"], row => row.Type == SalesEntryType.Income ? "Thu" : "Chi", 10),
                new(L["BE:Common:IncomeExpenseItem"], row => row.CategoryName, 24),
                new(L["BE:Field:Content"], row => row.Description, 40),
                new(L["BE:Perm:Customers"], row => row.PatientName ?? row.PayerName, 24),
                new(L["BE:Perm:Staff"], row => row.StaffName, 22),
                new(L["BE:Field:Amount"], row => row.Amount, 18),
                new(L["BE:Status:Approved"], row => row.CountsTowardsCashflow ? "Có" : "Chưa", 12)
            },
            page.Items);
    }

    private readonly IRepository<SalesEntry, Guid> _repository;
    private readonly IRepository<CashflowCategory, Guid> _categoryRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public SalesEntryAppService(
        IRepository<SalesEntry, Guid> repository,
        IRepository<CashflowCategory, Guid> categoryRepository,
        IRepository<Patient, Guid> patientRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _repository = repository;
        _categoryRepository = categoryRepository;
        _patientRepository = patientRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _softDeleteFilter = softDeleteFilter;
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

        return new PagedResultDto<SalesEntryDto>(totalCount, await MapToDtosAsync(items));
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
        return await MapToDtoAsync(await _repository.GetAsync(id));
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
            input.PatientId,
            input.PayerName);

        await _repository.InsertAsync(entry, autoSave: true);
        return await MapToDtoAsync(entry);
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
            input.PatientId,
            input.PayerName);

        await _repository.UpdateAsync(entry, autoSave: true);
        return await MapToDtoAsync(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> ApproveAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        entry.Approve(CurrentUser.GetId());
        await _repository.UpdateAsync(entry, autoSave: true);
        return await MapToDtoAsync(entry);
    }

    [Authorize(BlueDentalPermissions.Finance.Manage)]
    public async Task<SalesEntryDto> RejectAsync(Guid id, RejectSalesEntryInput input)
    {
        var entry = await _repository.GetAsync(id);
        entry.Reject(input.StaffId, input.Reason);
        await _repository.UpdateAsync(entry, autoSave: true);
        return await MapToDtoAsync(entry);
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

    /// <summary>
    /// Sequential per-branch, per-year code — <c>PT26-0001</c> / <c>PC26-0001</c>.
    /// The next number comes from the highest code already issued, not from a row
    /// count: the unique index also covers soft-deleted vouchers, and seeded data
    /// does not number the two series contiguously.
    /// </summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId, SalesEntryType type)
    {
        var prefix = $"{(type == SalesEntryType.Income ? "PT" : "PC")}{Clock.Now.Year % 100:D2}-";

        using var _ = _softDeleteFilter.Disable();
        var query = await _repository.GetQueryableAsync();
        var lastCode = query
            .Where(x => x.ClinicBranchId == clinicBranchId && x.Code.StartsWith(prefix))
            .Select(x => x.Code)
            .OrderByDescending(x => x)
            .FirstOrDefault();

        var sequence = lastCode is not null && int.TryParse(lastCode[prefix.Length..], out var last)
            ? last + 1
            : 1;

        return $"{prefix}{sequence:D4}";
    }

    private async Task<SalesEntryDto> MapToDtoAsync(SalesEntry entity)
    {
        return (await MapToDtosAsync(new[] { entity }))[0];
    }

    /// <summary>
    /// The grid and the export show names, not ids, so every DTO leaves here with
    /// its category, staff and patient resolved in three batched lookups.
    /// </summary>
    private async Task<List<SalesEntryDto>> MapToDtosAsync(IReadOnlyCollection<SalesEntry> entities)
    {
        if (entities.Count == 0)
        {
            return new List<SalesEntryDto>();
        }

        // The reference keeps showing a voucher's category after that category is
        // deleted, so the lookup reads through the soft-delete filter.
        var categoryIds = entities.Select(x => x.CategoryId).Distinct().ToList();
        Dictionary<Guid, string> categoryNames;
        using (_softDeleteFilter.Disable())
        {
            var categoryQuery = await _categoryRepository.GetQueryableAsync();
            categoryNames = categoryQuery
                .Where(c => categoryIds.Contains(c.Id))
                .ToDictionary(c => c.Id, c => c.Name);
        }

        var patientIds = entities.Where(x => x.PatientId.HasValue).Select(x => x.PatientId!.Value).Distinct().ToList();
        var patientNames = new Dictionary<Guid, (string Name, string Code)>();
        if (patientIds.Count > 0)
        {
            var patientQuery = await _patientRepository.GetQueryableAsync();
            patientNames = patientQuery
                .Where(p => patientIds.Contains(p.Id))
                .Select(p => new { p.Id, p.FirstName, p.LastName, p.PatientCode })
                .ToDictionary(p => p.Id, p => ($"{p.LastName} {p.FirstName}".Trim(), p.PatientCode));
        }

        var staffIds = entities.Select(x => x.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return entities
            .Select(entity =>
            {
                var dto = MapToDto(entity);
                dto.CategoryName = categoryNames.GetValueOrDefault(entity.CategoryId);
                dto.StaffName = staffNames.GetValueOrDefault(entity.StaffId);
                if (entity.PatientId.HasValue && patientNames.TryGetValue(entity.PatientId.Value, out var patient))
                {
                    dto.PatientName = patient.Name;
                    dto.PatientCode = patient.Code;
                }
                return dto;
            })
            .ToList();
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
        PayerName = entity.PayerName,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
