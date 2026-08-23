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

namespace BlueDental.Promotions;

/// <summary>
/// Voucher khuyến mãi.
/// </summary>
[Authorize(BlueDentalPermissions.Promotions.Default)]
public class VoucherAppService : ApplicationService, IVoucherAppService
{
    private readonly IRepository<Voucher, Guid> _repository;

    public VoucherAppService(IRepository<Voucher, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Promotions.View)]
    public async Task<PagedResultDto<VoucherDto>> GetListAsync(GetVoucherListInput input)
    {
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<VoucherDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalPermissions.Promotions.View)]
    public async Task<VoucherStatsDto> GetStatsAsync(Guid? clinicBranchId)
    {
        var query = await _repository.GetQueryableAsync();

        if (clinicBranchId.HasValue)
        {
            query = query.Where(x => x.ClinicBranchId == clinicBranchId.Value || x.ClinicBranchId == null);
        }

        var vouchers = query.ToList();

        return new VoucherStatsDto
        {
            Total = vouchers.Count,
            Active = vouchers.Count(x => x.Status == VoucherStatus.Active),
            Issued = vouchers.Count(x => x.UsedCount > 0),
            Expired = vouchers.Count(x => x.Status == VoucherStatus.Expired),
            TotalRedemptions = vouchers.Sum(x => x.UsedCount)
        };
    }

    [Authorize(BlueDentalPermissions.Promotions.View)]
    public async Task<VoucherDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalPermissions.Promotions.View)]
    public async Task<List<VoucherDto>> GetAvailableAsync(GetAvailableVouchersInput input)
    {
        var onDate = input.OnDate ?? DateOnly.FromDateTime(Clock.Now);
        var query = await _repository.GetQueryableAsync();

        if (input.ClinicBranchId.HasValue)
        {
            query = query.Where(x =>
                x.ClinicBranchId == input.ClinicBranchId.Value || x.ClinicBranchId == null);
        }

        return query
            .Where(x => x.Status == VoucherStatus.Active)
            .ToList()
            .Where(x => x.IsAvailableFor(onDate, input.OrderAmount, input.CustomerTarget))
            .OrderByDescending(x => x.CalculateDiscount(input.OrderAmount))
            .Select(MapToDto)
            .ToList();
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> CreateAsync(CreateVoucherDto input)
    {
        var code = input.Code.Trim().ToUpperInvariant();
        var query = await _repository.GetQueryableAsync();

        if (query.Any(x => x.Code == code))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.DuplicateVoucherCode,
                $"Voucher code {code} is already in use.");
        }

        var voucher = Voucher.Issue(
            GuidGenerator.Create(),
            code,
            input.Name,
            input.DiscountType,
            input.DiscountValue,
            input.ValidFrom,
            input.ValidTo,
            input.ClinicBranchId,
            input.MaxDiscountAmount,
            input.MinOrderAmount,
            input.CustomerTarget,
            input.UsageLimit,
            input.Description);

        await _repository.InsertAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> UpdateAsync(Guid id, UpdateVoucherDto input)
    {
        var voucher = await _repository.GetAsync(id);

        voucher.UpdateDetails(
            input.Name,
            input.Description,
            input.MinOrderAmount,
            input.MaxDiscountAmount,
            input.CustomerTarget);
        voucher.Reschedule(input.ValidFrom, input.ValidTo);

        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> ActivateAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        voucher.Activate();
        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> PauseAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        voucher.Pause();
        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, RedeemVoucherInput input)
    {
        var voucher = await _repository.GetAsync(id);
        var onDate = input.OnDate ?? DateOnly.FromDateTime(Clock.Now);

        var discount = voucher.Redeem(onDate, input.OrderAmount, input.CustomerTarget);
        await _repository.UpdateAsync(voucher, autoSave: true);

        return new VoucherRedemptionResultDto
        {
            VoucherId = voucher.Id,
            Code = voucher.Code,
            DiscountAmount = discount,
            AmountAfterDiscount = input.OrderAmount - discount,
            UsedCount = voucher.UsedCount,
            RemainingUses = voucher.RemainingUses,
            Status = voucher.Status
        };
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);

        if (voucher.UsedCount > 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherLocked,
                "A redeemed voucher cannot be deleted; pause it instead.");
        }

        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>Marks vouchers whose validity window has passed as expired.</summary>
    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<int> ExpireOutdatedAsync(DateOnly asOf)
    {
        var query = await _repository.GetQueryableAsync();
        var outdated = query
            .Where(x => x.Status != VoucherStatus.Expired && x.ValidTo < asOf)
            .ToList();

        foreach (var voucher in outdated)
        {
            voucher.Expire();
            await _repository.UpdateAsync(voucher);
        }

        return outdated.Count;
    }

    private async Task<IQueryable<Voucher>> BuildQueryAsync(GetVoucherListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.ClinicBranchId.HasValue)
            query = query.Where(x =>
                x.ClinicBranchId == input.ClinicBranchId.Value || x.ClinicBranchId == null);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);
        if (input.CustomerTarget.HasValue)
            query = query.Where(x => x.CustomerTarget == input.CustomerTarget.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Code.Contains(filter) || x.Name.Contains(filter));
        }

        return query;
    }

    private static VoucherDto MapToDto(Voucher entity) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Code = entity.Code,
        Name = entity.Name,
        Description = entity.Description,
        DiscountType = entity.DiscountType,
        DiscountValue = entity.DiscountValue,
        MaxDiscountAmount = entity.MaxDiscountAmount,
        MinOrderAmount = entity.MinOrderAmount,
        CustomerTarget = entity.CustomerTarget,
        ValidFrom = entity.ValidFrom,
        ValidTo = entity.ValidTo,
        UsageLimit = entity.UsageLimit,
        UsedCount = entity.UsedCount,
        RemainingUses = entity.RemainingUses,
        Status = entity.Status,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
