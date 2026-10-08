using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.PrepaidCards;

/// <summary>
/// Thẻ trả trước (/prepaid-card). BlueDental-local (function list cụm 3);
/// see docs/clone/pages/prepaid-card.md.
///
/// Card types and cards belong to the branch that set them up or sold them,
/// and are managed there. A card is the customer's, though: it pays for their
/// services at any branch (<see cref="GetUsableAsync"/>, guarded by the
/// payment permission, not this one).
/// </summary>
[Authorize]
public class PrepaidCardAppService(
    IRepository<PrepaidCardType, Guid> typeRepository,
    IRepository<PrepaidCard, Guid> cardRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<PatientPayment, Guid> paymentRepository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : ApplicationService, IPrepaidCardAppService
{
    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Read)]
    public async Task<ListResultDto<PrepaidCardTypeDto>> GetTypeListAsync(GetPrepaidCardTypeListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await typeRepository.GetQueryableAsync();
        if (branchFilter.Count > 0) query = query.Where(t => branchFilter.Contains(t.ClinicBranchId));
        if (input.OnSaleOnly) query = query.Where(t => t.IsOnSale);
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(t => t.Name.ToLower().Contains(term));
        }

        var types = await AsyncExecuter.ToListAsync(query.OrderByDescending(t => t.CreationTime));
        var typeIds = types.Select(t => t.Id).ToList();
        var cards = await cardRepository.GetQueryableAsync();
        var sold = await AsyncExecuter.ToListAsync(cards
            .Where(c => typeIds.Contains(c.CardTypeId))
            .GroupBy(c => c.CardTypeId)
            .Select(g => new { g.Key, Count = g.Count() }));
        var soldByType = sold.ToDictionary(x => x.Key, x => x.Count);

        return new ListResultDto<PrepaidCardTypeDto>(
            types.Select(t => MapType(t, soldByType.GetValueOrDefault(t.Id))).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Create)]
    public async Task<PrepaidCardTypeDto> CreateTypeAsync(SavePrepaidCardTypeDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty, branchResolver.GetRequiredClinicBranchId());

        var type = new PrepaidCardType(
            GuidGenerator.Create(), branchId, input.Name, input.SalePrice, input.UsageValue, input.MaxUses,
            input.CommissionType, input.CommissionValue, input.AllowFamily, input.ServiceIds,
            input.ServiceGroupIds, input.Note);
        type.SetOnSale(input.IsOnSale);

        await typeRepository.InsertAsync(type, autoSave: true);
        return MapType(type, 0);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Update)]
    public async Task<PrepaidCardTypeDto> UpdateTypeAsync(Guid id, SavePrepaidCardTypeDto input)
    {
        var type = await typeRepository.GetAsync(id);
        await GuardBranchAccessAsync(type);

        type.Update(input.Name, input.SalePrice, input.UsageValue, input.MaxUses, input.CommissionType,
            input.CommissionValue, input.AllowFamily, input.ServiceIds, input.ServiceGroupIds, input.Note);
        type.SetOnSale(input.IsOnSale);

        await typeRepository.UpdateAsync(type, autoSave: true);
        return MapType(type, await cardRepository.CountAsync(c => c.CardTypeId == id));
    }

    /// <summary>Sold cards keep working: they carry a copy of the type's terms.</summary>
    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Delete)]
    public async Task DeleteTypeAsync(Guid id)
    {
        var type = await typeRepository.GetAsync(id);
        await GuardBranchAccessAsync(type);
        await typeRepository.DeleteAsync(type, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Read)]
    public async Task<PagedResultDto<PrepaidCardDto>> GetListAsync(GetPrepaidCardListInput input)
    {
        var query = await FilterAsync(input);
        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(c => c.SoldAt)
            .ThenByDescending(c => c.Code)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<PrepaidCardDto>(total, await MapCardsAsync(page));
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Read)]
    public async Task<PrepaidCardSummaryDto> GetSummaryAsync(GetPrepaidCardListInput input)
    {
        var query = await FilterAsync(new GetPrepaidCardListInput { ClinicBranchId = input.ClinicBranchId });
        var cards = await AsyncExecuter.ToListAsync(query.Select(c => new
        {
            c.Id,
            c.Status,
            c.Balance,
            c.MaxUses,
            c.UsedCount,
            c.CommissionAmount,
        }));

        var cardIds = cards.Select(c => c.Id).ToList();
        var withLedger = await cardRepository.WithDetailsAsync(c => c.Transactions);
        var received = await AsyncExecuter.ToListAsync(withLedger
            .Where(c => cardIds.Contains(c.Id))
            .SelectMany(c => c.Transactions)
            .Select(t => t.PaidAmount));

        return new PrepaidCardSummaryDto
        {
            CardCount = cards.Count,
            UsableCount = cards.Count(c =>
                c.Status == PrepaidCardStatus.Active && c.Balance > 0m
                && (!c.MaxUses.HasValue || c.UsedCount < c.MaxUses.Value)),
            OutstandingBalance = cards.Sum(c => c.Balance),
            MoneyReceived = received.Sum(),
            CommissionTotal = cards.Sum(c => c.CommissionAmount),
        };
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Read)]
    public async Task<PrepaidCardDetailDto> GetAsync(Guid id) => await MapDetailAsync(await LoadAsync(id));

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Create)]
    public async Task<PrepaidCardDetailDto> SellAsync(SellPrepaidCardDto input)
    {
        var type = await typeRepository.GetAsync(input.CardTypeId);
        await GuardBranchAccessAsync(type);

        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty, type.ClinicBranchId);
        await EnsurePatientsExistAsync([input.OwnerPatientId, .. input.MemberPatientIds]);
        await EnsureStaffExistsAsync(input.SellerStaffId);

        var soldAt = input.SoldAt ?? Clock.Now;
        PatientPayment.EnsureNotAfterToday(soldAt, DateTimeOffset.UtcNow);

        var card = PrepaidCard.Sell(
            GuidGenerator.Create(), await GenerateCodeAsync(soldAt), type, branchId, input.OwnerPatientId,
            input.MemberPatientIds, input.SellerStaffId, soldAt, input.Method, input.PaymentAccountId,
            CurrentUser.Id, input.Note, GuidGenerator.Create());

        await cardRepository.InsertAsync(card, autoSave: true);
        return await MapDetailAsync(card);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Update)]
    public async Task<PrepaidCardDetailDto> TopupAsync(Guid id, TopupPrepaidCardDto input)
    {
        var card = await LoadAsync(id);
        var at = input.OccurredAt ?? Clock.Now;
        PatientPayment.EnsureNotAfterToday(at, DateTimeOffset.UtcNow);

        card.Topup(input.Value, input.PaidAmount ?? input.Value, input.Method, input.PaymentAccountId, at,
            CurrentUser.Id, input.Note, GuidGenerator.Create());

        await cardRepository.UpdateAsync(card, autoSave: true);
        return await MapDetailAsync(card);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Update)]
    public async Task<PrepaidCardDetailDto> SetMembersAsync(Guid id, SetPrepaidCardMembersDto input)
    {
        var card = await LoadAsync(id);
        await EnsurePatientsExistAsync(input.MemberPatientIds);
        card.SetMembers(input.MemberPatientIds);

        await cardRepository.UpdateAsync(card, autoSave: true);
        return await MapDetailAsync(card);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Update)]
    public async Task<PrepaidCardDetailDto> LockAsync(Guid id)
    {
        var card = await LoadAsync(id);
        card.Lock();
        await cardRepository.UpdateAsync(card, autoSave: true);
        return await MapDetailAsync(card);
    }

    [Authorize(BlueDentalAbilityPermissions.PrepaidCard.Update)]
    public async Task<PrepaidCardDetailDto> UnlockAsync(Guid id)
    {
        var card = await LoadAsync(id);
        card.Unlock();
        await cardRepository.UpdateAsync(card, autoSave: true);
        return await MapDetailAsync(card);
    }

    /// <summary>
    /// What the payment dialog offers under "Thẻ trả trước": active cards the
    /// patient owns or shares, with value and a use left. Any branch — the
    /// card is the customer's, wherever they are treated.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<ListResultDto<PrepaidCardDto>> GetUsableAsync(Guid patientId)
    {
        var query = await cardRepository.GetQueryableAsync();
        var cards = await AsyncExecuter.ToListAsync(query
            .Where(c => c.OwnerPatientId == patientId || c.MemberPatientIds.Contains(patientId))
            .Where(c => c.Status == PrepaidCardStatus.Active && c.Balance > 0m)
            .Where(c => !c.MaxUses.HasValue || c.UsedCount < c.MaxUses.Value)
            .OrderBy(c => c.SoldAt));

        return new ListResultDto<PrepaidCardDto>(await MapCardsAsync(cards));
    }

    private async Task<IQueryable<PrepaidCard>> FilterAsync(GetPrepaidCardListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await cardRepository.GetQueryableAsync();

        if (branchFilter.Count > 0) query = query.Where(c => branchFilter.Contains(c.ClinicBranchId));
        if (input.CardTypeId.HasValue) query = query.Where(c => c.CardTypeId == input.CardTypeId.Value);
        if (input.PatientId.HasValue)
        {
            var patientId = input.PatientId.Value;
            query = query.Where(c => c.OwnerPatientId == patientId || c.MemberPatientIds.Contains(patientId));
        }

        query = input.State switch
        {
            PrepaidCardListState.Locked => query.Where(c => c.Status == PrepaidCardStatus.Locked),
            PrepaidCardListState.Usable => query.Where(c =>
                c.Status == PrepaidCardStatus.Active && c.Balance > 0m
                && (!c.MaxUses.HasValue || c.UsedCount < c.MaxUses.Value)),
            PrepaidCardListState.Exhausted => query.Where(c =>
                c.Status == PrepaidCardStatus.Active
                && (c.Balance <= 0m || (c.MaxUses.HasValue && c.UsedCount >= c.MaxUses.Value))),
            _ => query,
        };

        foreach (var term in SearchTerms.From(input.Filter))
        {
            var owners = await MatchingPatientIdsAsync(term);
            query = query.Where(c => c.Code.ToLower().Contains(term) || owners.Contains(c.OwnerPatientId));
        }

        return query;
    }

    private async Task<List<Guid>> MatchingPatientIdsAsync(string term)
    {
        var patients = await patientRepository.GetQueryableAsync();
        return await AsyncExecuter.ToListAsync(patients
            .Where(p => p.PatientCode.ToLower().Contains(term)
                        || p.FirstName.ToLower().Contains(term)
                        || p.LastName.ToLower().Contains(term))
            .Select(p => p.Id)
            .Take(500));
    }

    private async Task<PrepaidCard> LoadAsync(Guid id)
    {
        var query = await cardRepository.WithDetailsAsync(c => c.Transactions);
        var card = await AsyncExecuter.FirstOrDefaultAsync(query.Where(c => c.Id == id))
                   ?? throw new EntityNotFoundException(typeof(PrepaidCard), id);
        await GuardBranchAccessAsync(card);
        return card;
    }

    /// <summary>Another branch's card or type reads as missing, not as forbidden.</summary>
    private async Task GuardBranchAccessAsync(IEntity<Guid> entity)
    {
        var clinicBranchId = entity switch
        {
            PrepaidCard card => card.ClinicBranchId,
            PrepaidCardType type => type.ClinicBranchId,
            _ => throw new ArgumentOutOfRangeException(nameof(entity)),
        };

        if (!await branchAccess.IsAllowedAsync(clinicBranchId))
        {
            throw new EntityNotFoundException(entity.GetType(), entity.Id);
        }
    }

    private async Task EnsurePatientsExistAsync(IReadOnlyCollection<Guid> patientIds)
    {
        var ids = patientIds.Distinct().ToList();
        if (ids.Count == 0) return;

        var found = await patientRepository.CountAsync(p => ids.Contains(p.Id));
        if (found != ids.Count)
        {
            throw new EntityNotFoundException(typeof(Patient));
        }
    }

    private async Task EnsureStaffExistsAsync(Guid staffId)
    {
        if (await userRepository.FindAsync(staffId) is null)
        {
            throw new EntityNotFoundException(typeof(IdentityUser), staffId);
        }
    }

    /// <summary>
    /// <c>TT26-0001</c>: one sequence per year across every branch — the code is
    /// unique clinic-wide — taken from the highest number issued, deleted cards
    /// included, so a number is never handed out twice.
    /// </summary>
    private async Task<string> GenerateCodeAsync(DateTimeOffset soldAt)
    {
        var prefix = $"{PrepaidCardConsts.CodePrefix}{soldAt.Year % 100:D2}-";

        using var _ = DataFilter.Disable<ISoftDelete>();
        var query = await cardRepository.GetQueryableAsync();
        var last = await AsyncExecuter.FirstOrDefaultAsync(query
            .Where(c => c.Code.StartsWith(prefix))
            .OrderByDescending(c => c.Code)
            .Select(c => c.Code));

        var sequence = last is not null && int.TryParse(last[prefix.Length..], out var n) ? n + 1 : 1;
        return $"{prefix}{sequence:D4}";
    }

    private static PrepaidCardTypeDto MapType(PrepaidCardType t, int soldCount) => new()
    {
        Id = t.Id,
        ClinicBranchId = t.ClinicBranchId,
        Name = t.Name,
        SalePrice = t.SalePrice,
        UsageValue = t.UsageValue,
        MaxUses = t.MaxUses,
        CommissionType = t.CommissionType,
        CommissionValue = t.CommissionValue,
        AllowFamily = t.AllowFamily,
        ServiceIds = t.ServiceIds.ToList(),
        ServiceGroupIds = t.ServiceGroupIds.ToList(),
        IsOnSale = t.IsOnSale,
        Note = t.Note,
        SoldCount = soldCount,
        CreationTime = t.CreationTime,
    };

    private async Task<List<PrepaidCardDto>> MapCardsAsync(IReadOnlyCollection<PrepaidCard> cards)
    {
        var names = await NamesAsync(cards, []);
        return cards.Select(c => Fill(new PrepaidCardDto(), c, names)).ToList();
    }

    private async Task<PrepaidCardDetailDto> MapDetailAsync(PrepaidCard card)
    {
        var names = await NamesAsync([card], card.Transactions.ToList());
        var dto = Fill(new PrepaidCardDetailDto(), card, names);

        var balance = 0m;
        var lines = new List<PrepaidCardTransactionDto>();
        foreach (var t in card.Transactions.OrderBy(t => t.Sequence))
        {
            balance += t.SignedValue;
            lines.Add(new PrepaidCardTransactionDto
            {
                Id = t.Id,
                Sequence = t.Sequence,
                Type = t.Type,
                Value = t.Value,
                BalanceAfter = balance,
                PaidAmount = t.PaidAmount,
                Method = t.Method,
                PatientId = t.PatientId,
                PatientName = t.PatientId.HasValue ? names.Patients.GetValueOrDefault(t.PatientId.Value).Name : null,
                PatientPaymentId = t.PatientPaymentId,
                PatientPaymentCode = t.PatientPaymentId.HasValue
                    ? names.Payments.GetValueOrDefault(t.PatientPaymentId.Value)
                    : null,
                StaffName = t.StaffId.HasValue ? names.Staff.GetValueOrDefault(t.StaffId.Value) : null,
                OccurredAt = t.OccurredAt,
                Note = t.Note,
            });
        }

        lines.Reverse();
        dto.Transactions = lines;
        return dto;
    }

    private static T Fill<T>(T dto, PrepaidCard c, Names names) where T : PrepaidCardDto
    {
        var owner = names.Patients.GetValueOrDefault(c.OwnerPatientId);
        dto.Id = c.Id;
        dto.ClinicBranchId = c.ClinicBranchId;
        dto.Code = c.Code;
        dto.CardTypeId = c.CardTypeId;
        dto.Name = c.Name;
        dto.OwnerPatientId = c.OwnerPatientId;
        dto.OwnerName = owner.Name;
        dto.OwnerCode = owner.Code;
        dto.AllowFamily = c.AllowFamily;
        dto.Members = c.MemberPatientIds
            .Select(id => new PrepaidCardMemberDto
            {
                PatientId = id,
                Name = names.Patients.GetValueOrDefault(id).Name,
                Code = names.Patients.GetValueOrDefault(id).Code,
            })
            .ToList();
        dto.SalePrice = c.SalePrice;
        dto.UsageValue = c.UsageValue;
        dto.TotalLoaded = c.TotalLoaded;
        dto.Balance = c.Balance;
        dto.MaxUses = c.MaxUses;
        dto.UsedCount = c.UsedCount;
        dto.RemainingUses = c.RemainingUses;
        dto.ServiceIds = c.ServiceIds.ToList();
        dto.ServiceGroupIds = c.ServiceGroupIds.ToList();
        dto.SellerStaffId = c.SellerStaffId;
        dto.SellerName = names.Staff.GetValueOrDefault(c.SellerStaffId);
        dto.CommissionAmount = c.CommissionAmount;
        dto.SoldAt = c.SoldAt;
        dto.Status = c.Status;
        dto.IsExhausted = c.IsExhausted;
        dto.Note = c.Note;
        return dto;
    }

    private sealed record Names(
        Dictionary<Guid, (string? Name, string? Code)> Patients,
        Dictionary<Guid, string> Staff,
        Dictionary<Guid, string> Payments);

    /// <summary>Patient, staff and receipt names for one page, in three batched lookups.</summary>
    private async Task<Names> NamesAsync(
        IReadOnlyCollection<PrepaidCard> cards, IReadOnlyCollection<PrepaidCardTransaction> transactions)
    {
        var patientIds = cards.Select(c => c.OwnerPatientId)
            .Concat(cards.SelectMany(c => c.MemberPatientIds))
            .Concat(transactions.Where(t => t.PatientId.HasValue).Select(t => t.PatientId!.Value))
            .Distinct()
            .ToList();
        var patients = patientIds.Count == 0
            ? new Dictionary<Guid, (string? Name, string? Code)>()
            : (await patientRepository.GetListAsync(p => patientIds.Contains(p.Id)))
                .ToDictionary(p => p.Id, p => ((string?)p.FullName, (string?)p.PatientCode));

        var staffIds = cards.Select(c => c.SellerStaffId)
            .Concat(transactions.Where(t => t.StaffId.HasValue).Select(t => t.StaffId!.Value))
            .Distinct()
            .ToList();
        var staff = (await userRepository.GetListByIdsAsync(staffIds))
            .ToDictionary(u => u.Id, StaffName);

        var paymentIds = transactions.Where(t => t.PatientPaymentId.HasValue)
            .Select(t => t.PatientPaymentId!.Value)
            .Distinct()
            .ToList();
        var payments = new Dictionary<Guid, string>();
        if (paymentIds.Count > 0)
        {
            // A cancelled or still-pending receipt is exactly what a Hoàn lại line points at.
            using var cancelled = DataFilter.Disable<ISoftDelete>();
            using var pending = DataFilter.Disable<ISettleable>();
            var query = await paymentRepository.GetQueryableAsync();
            payments = (await AsyncExecuter.ToListAsync(query
                    .Where(p => paymentIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.Code })))
                .ToDictionary(p => p.Id, p => p.Code);
        }

        return new Names(patients, staff, payments);
    }

    private static string StaffName(IdentityUser user) =>
        string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)))
            is { Length: > 0 } name
            ? name
            : user.UserName;
}
