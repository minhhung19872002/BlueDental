using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Promotions;

[Authorize(BlueDentalPermissions.Promotions.Default)]
public class VoucherAppService : ApplicationService, IVoucherAppService
{
    private readonly IRepository<Voucher, Guid> _repository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public VoucherAppService(
        IRepository<Voucher, Guid> repository,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
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
    public async Task<VoucherDto> GetAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.View)]
    public async Task<List<VoucherDto>> GetAvailableAsync(GetAvailableVouchersInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var onDate = input.OnDate ?? DateOnly.FromDateTime(Clock.Now);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId!.Value) || x.ClinicBranchId == null);

        return query
            .Where(x => x.Status == VoucherStatus.Active && x.IsPublished)
            .ToList()
            .Where(x => x.IsAvailableFor(onDate, input.OrderAmount))
            .OrderByDescending(x => x.CalculateDiscount(input.OrderAmount))
            .Select(MapToDto)
            .ToList();
    }

    /// <summary>
    /// The prefix shown before every voucher code. Server-owned so the client
    /// never invents its own; the codes themselves are generated client-side
    /// (or here on submit when left blank).
    /// </summary>
    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public Task<VoucherCodePrefixDto> GetCodePrefixAsync()
    {
        return Task.FromResult(new VoucherCodePrefixDto { Prefix = VoucherConsts.DefaultPrefix });
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> CreateAsync(CreateVoucherDto input)
    {
        var ownBranchId = _branchResolver.GetRequiredClinicBranchId();
        var branchId = await _branchAccess.ResolveWriteTargetAsync(
            input.BranchId ?? Guid.Empty, ownBranchId);
        var code = ComposeFullCode(input.Prefix, string.IsNullOrWhiteSpace(input.Code)
            ? GenerateRandomCode()
            : input.Code.Trim().ToUpperInvariant());

        await GuardDuplicateCodeAsync(code);

        var voucher = CreateVoucherEntity(
            code, input.Name, input.Prefix, input.Description,
            input.DiscountType, input.DiscountValue, input.MaxDiscountAmount,
            input.ScopeTarget, input.TargetIds, input.MinOrderValue,
            input.StartDate, input.EndDate,
            input.UsageLimit, input.PerCustomerLimit,
            input.IsExclusive, input.CustomerTargets,
            input.IsDaysOfWeekLimited, input.DaysOfWeek,
            input.DisplayOnNfcDental, branchId);

        await _repository.InsertAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<List<VoucherDto>> CreateBatchAsync(CreateVoucherBatchDto input)
    {
        if (input.Count is < 1 or > 100)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidUsageLimit,
                "Batch count must be between 1 and 100.");

        var ownBranchId = _branchResolver.GetRequiredClinicBranchId();
        var branchId = await _branchAccess.ResolveWriteTargetAsync(
            input.BranchId ?? Guid.Empty, ownBranchId);
        var vouchers = new List<Voucher>();
        var codesInBatch = new HashSet<string>();

        for (var i = 0; i < input.Count; i++)
        {
            var item = i < input.Items.Count ? input.Items[i] : null;
            var code = ComposeFullCode(input.Prefix, !string.IsNullOrWhiteSpace(item?.Code)
                ? item.Code.Trim().ToUpperInvariant()
                : GenerateRandomCode());
            var name = !string.IsNullOrWhiteSpace(item?.Name)
                ? item.Name
                : $"{input.Prefix ?? ""}#{i + 1}";

            // InsertManyAsync flushes after the loop, so the repository guard
            // cannot see codes queued earlier in this same batch.
            if (!codesInBatch.Add(code))
                throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.DuplicateVoucherCode,
                    $"Voucher code {code} appears more than once in the batch.");

            await GuardDuplicateCodeAsync(code);

            // An item carrying its own DiscountType is a fully-configured
            // item ("cấu hình riêng"): its nullable fields are taken verbatim
            // instead of falling back, so a per-code blank stays blank.
            var ownConfig = item?.DiscountType != null;

            var voucher = CreateVoucherEntity(
                code, name, input.Prefix,
                (ownConfig ? item!.Description : null) ?? input.Description,
                item?.DiscountType ?? input.DiscountType,
                item?.DiscountValue ?? input.DiscountValue,
                ownConfig ? item!.MaxDiscountAmount : input.MaxDiscountAmount,
                item?.ScopeTarget ?? input.ScopeTarget,
                item?.TargetIds ?? input.TargetIds,
                ownConfig ? item!.MinOrderValue : input.MinOrderValue,
                item?.StartDate ?? input.StartDate,
                item?.EndDate ?? input.EndDate,
                ownConfig ? item!.UsageLimit : input.UsageLimit,
                ownConfig ? item!.PerCustomerLimit : input.PerCustomerLimit,
                item?.IsExclusive ?? input.IsExclusive,
                item?.CustomerTargets ?? input.CustomerTargets,
                item?.IsDaysOfWeekLimited ?? input.IsDaysOfWeekLimited,
                item?.DaysOfWeek ?? input.DaysOfWeek,
                item?.DisplayOnNfcDental ?? input.DisplayOnNfcDental,
                branchId);

            vouchers.Add(voucher);
        }

        await _repository.InsertManyAsync(vouchers, autoSave: true);
        return vouchers.Select(MapToDto).ToList();
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> UpdateAsync(Guid id, UpdateVoucherDto input)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);

        // A prefix in the payload is adopted (healing pre-prefix vouchers on
        // their next edit); blank keeps the stored one.
        var prefix = string.IsNullOrWhiteSpace(input.Prefix) ? voucher.Prefix : input.Prefix;
        if (prefix != voucher.Prefix)
            voucher.ChangePrefix(prefix);

        // The ref lets the edit dialog rewrite the code; a blank one means
        // "give me a fresh code", mirroring create. The dialog edits the bare
        // part, so rejoin the prefix.
        var code = ComposeFullCode(prefix, string.IsNullOrWhiteSpace(input.Code)
            ? GenerateRandomCode()
            : input.Code.Trim().ToUpperInvariant());
        if (code != voucher.Code)
        {
            await GuardDuplicateCodeAsync(code);
            voucher.ChangeCode(code);
        }

        voucher.ChangeDiscount(ParseDiscountType(input.DiscountType), input.DiscountValue);

        var scopeTarget = ParseScopeTarget(input.ScopeTarget);
        var targetIds = input.TargetIds.Select(Guid.Parse).ToList();

        voucher.UpdateDetails(
            input.Name,
            input.Description,
            scopeTarget,
            targetIds,
            input.MinOrderValue,
            input.MaxDiscountAmount,
            input.IsExclusive,
            input.CustomerTargets.ToList(),
            input.PerCustomerLimit,
            input.IsDaysOfWeekLimited,
            input.DaysOfWeek.ToList(),
            input.DisplayOnNfcDental);

        voucher.Reschedule(
            DateOnly.FromDateTime(input.StartDate),
            DateOnly.FromDateTime(input.EndDate));

        if (input.UsageLimit != voucher.UsageLimit)
            voucher.UpdateUsageLimit(input.UsageLimit);

        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> PublishAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);
        voucher.Publish();
        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherDto> UnpublishAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);
        voucher.Unpublish();
        await _repository.UpdateAsync(voucher, autoSave: true);
        return MapToDto(voucher);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<VoucherRedemptionResultDto> RedeemAsync(Guid id, RedeemVoucherInput input)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);
        var onDate = input.OnDate ?? DateOnly.FromDateTime(Clock.Now);

        var discount = voucher.Redeem(onDate, input.OrderAmount);
        await _repository.UpdateAsync(voucher, autoSave: true);

        return new VoucherRedemptionResultDto
        {
            VoucherId = voucher.Id,
            Code = voucher.Code,
            DiscountAmount = discount,
            AmountAfterDiscount = input.OrderAmount - discount,
            UsedCount = voucher.UsedCount,
            RemainingUses = voucher.RemainingUses,
            Status = MapStatus(voucher.Status)
        };
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var voucher = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(voucher);
        await _repository.DeleteAsync(voucher, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Promotions.Manage)]
    public async Task<int> ExpireOutdatedAsync(DateOnly asOf)
    {
        var query = await _repository.GetQueryableAsync();
        var outdated = query
            .Where(x => x.Status == VoucherStatus.Active && x.ValidTo < asOf)
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
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId!.Value) || x.ClinicBranchId == null);

        if (!string.IsNullOrWhiteSpace(input.Status))
        {
            query = input.Status switch
            {
                "active" => query.Where(x => x.Status == VoucherStatus.Active && x.IsPublished),
                "expired" => query.Where(x => x.Status == VoucherStatus.Expired),
                "out_of_uses" => query.Where(x => x.Status == VoucherStatus.OutOfUses),
                "created" => query.Where(x => !x.IsPublished && x.Status == VoucherStatus.Active),
                _ => query
            };
        }

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Code.Contains(filter) || x.Name.Contains(filter));
        }

        return query;
    }

    private Voucher CreateVoucherEntity(
        string code, string name, string? prefix, string? description,
        string discountTypeStr, decimal discountValue, decimal? maxDiscountAmount,
        string scopeTargetStr, List<string> targetIds, decimal? minOrderValue,
        DateTime startDate, DateTime endDate,
        int? usageLimit, int? perCustomerLimit,
        bool isExclusive, string[] customerTargets,
        bool isDaysOfWeekLimited, int[] daysOfWeek,
        bool displayOnNfcDental, Guid branchId)
    {
        var discountType = ParseDiscountType(discountTypeStr);
        var scopeTarget = ParseScopeTarget(scopeTargetStr);
        var parsedTargetIds = targetIds.Select(Guid.Parse).ToList();

        return Voucher.Issue(
            GuidGenerator.Create(),
            code,
            name,
            discountType,
            discountValue,
            DateOnly.FromDateTime(startDate),
            DateOnly.FromDateTime(endDate),
            scopeTarget,
            clinicBranchId: branchId,
            prefix: prefix,
            targetIds: parsedTargetIds,
            maxDiscountAmount: maxDiscountAmount,
            minOrderValue: minOrderValue,
            isExclusive: isExclusive,
            customerTargets: customerTargets.ToList(),
            usageLimit: usageLimit,
            perCustomerLimit: perCustomerLimit,
            isDaysOfWeekLimited: isDaysOfWeekLimited,
            daysOfWeek: daysOfWeek.ToList(),
            displayOnNfcDental: displayOnNfcDental,
            description: description);
    }

    private async Task GuardDuplicateCodeAsync(string code)
    {
        var query = await _repository.GetQueryableAsync();
        if (query.Any(x => x.Code == code))
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.DuplicateVoucherCode,
                $"Voucher code {code} is already in use.");
    }

    // The stored code is the full customer-facing code ("HN-XXXXXXXX"): the
    // client sends the bare part and the prefix gets joined in here. The
    // prefix also keeps its own column so the edit dialog can split it back
    // off for display.
    private static string ComposeFullCode(string? prefix, string code)
    {
        var p = prefix?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(p)) return code;
        var withDash = p + "-";
        return code.StartsWith(withDash, StringComparison.Ordinal) ? code : withDash + code;
    }

    private static string GenerateRandomCode()
    {
        return new string(Enumerable.Range(0, VoucherConsts.GeneratedCodeLength)
            .Select(_ => VoucherConsts.CodeAlphabet[Random.Shared.Next(VoucherConsts.CodeAlphabet.Length)])
            .ToArray());
    }

    private static DiscountType ParseDiscountType(string value) => value switch
    {
        "percentage" => DiscountType.Percentage,
        "fixed_amount" => DiscountType.Money,
        _ => throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount,
            $"Invalid discount type: {value}")
    };

    private static VoucherScopeTarget ParseScopeTarget(string value) => value switch
    {
        "service" => VoucherScopeTarget.Service,
        "treatment" => VoucherScopeTarget.Treatment,
        _ => throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition,
            $"Invalid scope target: {value}")
    };

    private static string MapDiscountType(DiscountType dt) => dt switch
    {
        DiscountType.Percentage => "percentage",
        DiscountType.Money => "fixed_amount",
        _ => "percentage"
    };

    private static string MapScopeTarget(VoucherScopeTarget st) => st switch
    {
        VoucherScopeTarget.Service => "service",
        VoucherScopeTarget.Treatment => "treatment",
        _ => "service"
    };

    private static string MapStatus(VoucherStatus s) => s switch
    {
        VoucherStatus.Active => "active",
        VoucherStatus.Expired => "expired",
        VoucherStatus.OutOfUses => "out_of_uses",
        _ => "active"
    };

    private async Task GuardBranchAccessAsync(Voucher entity)
    {
        if (entity.ClinicBranchId.HasValue && !await _branchAccess.IsAllowedAsync(entity.ClinicBranchId.Value))
            throw new Volo.Abp.Domain.Entities.EntityNotFoundException(typeof(Voucher), entity.Id);
    }

    private static VoucherDto MapToDto(Voucher entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Code = entity.Code,
        Prefix = entity.Prefix,
        Description = entity.Description,
        DiscountType = MapDiscountType(entity.DiscountType),
        DiscountValue = entity.DiscountValue,
        MinOrderValue = entity.MinOrderValue,
        MaxDiscountAmount = entity.MaxDiscountAmount,
        ScopeTarget = MapScopeTarget(entity.ScopeTarget),
        TargetIds = entity.TargetIds.Select(x => x.ToString()).ToList(),
        StartDate = entity.ValidFrom.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
        EndDate = entity.ValidTo.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
        UsageLimit = entity.UsageLimit,
        UsedCount = entity.UsedCount,
        Status = MapStatus(entity.Status),
        IsPublished = entity.IsPublished,
        PublishedAt = entity.PublishedAt,
        IsExclusive = entity.IsExclusive,
        CustomerTargets = entity.CustomerTargets.ToArray(),
        PerCustomerLimit = entity.PerCustomerLimit,
        IsDaysOfWeekLimited = entity.IsDaysOfWeekLimited,
        DaysOfWeek = entity.DaysOfWeek.ToArray(),
        DisplayOnNfcDental = entity.DisplayOnNfcDental,
        ClinicBranchId = entity.ClinicBranchId,
        IsDeleted = entity.IsDeleted,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
