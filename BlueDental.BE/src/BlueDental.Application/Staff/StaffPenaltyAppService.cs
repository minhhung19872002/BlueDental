using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Staff;

/// <summary>
/// Nhân viên → Chế tài (/staff/penalties). BlueDental-local; see
/// docs/clone/pages/staff-penalty.md.
///
/// The workflow rules live on <see cref="StaffPenalty"/>; this service checks
/// what crosses aggregates — the branch the caller may touch, that the staff
/// member works at that branch, and that the violation type is the branch's own.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.StaffPenalty.Read)]
public class StaffPenaltyAppService(
    IRepository<StaffPenalty, Guid> repository,
    IRepository<StaffViolationType, Guid> typeRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : ApplicationService, IStaffPenaltyAppService
{
    private static readonly TimeSpan ClinicUtcOffset = TimeSpan.FromHours(7);

    private static DateOnly ClinicToday =>
        DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(ClinicUtcOffset).Date);

    public async Task<StaffPenaltyListResultDto> GetListAsync(GetStaffPenaltyListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.StaffId.HasValue) query = query.Where(x => x.StaffId == input.StaffId.Value);
        if (input.Status.HasValue) query = query.Where(x => x.Status == input.Status.Value);
        if (input.FromDate.HasValue) query = query.Where(x => x.ViolationDate >= input.FromDate.Value);
        if (input.ToDate.HasValue) query = query.Where(x => x.ViolationDate <= input.ToDate.Value);

        var term = input.Filter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            // Names live on the identity user, not on the record, so the matching
            // people are found first and the record matched by id or description.
            var matchingStaff = (await userRepository.GetListAsync())
                .Where(u => FullName(u).ToLowerInvariant().Contains(term)
                    || u.UserName.ToLowerInvariant().Contains(term))
                .Select(u => u.Id)
                .ToList();
            query = query.Where(x => matchingStaff.Contains(x.StaffId)
                || (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var approvedFineTotal = await AsyncExecuter.SumAsync(
            query.Where(x => x.Status == StaffPenaltyStatus.Approved), x => x.FineAmount);
        var page = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(x => x.ViolationDate)
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new StaffPenaltyListResultDto
        {
            TotalCount = totalCount,
            ApprovedFineTotal = approvedFineTotal,
            Items = await MapAsync(page),
        };
    }

    public async Task<StaffPenaltyDto> GetAsync(Guid id) => (await MapAsync([await GetCheckedAsync(id)]))[0];

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Create)]
    public async Task<StaffPenaltyDto> CreateAsync(CreateStaffPenaltyDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            branchResolver.GetRequiredClinicBranchId());
        await CheckReferencesAsync(branchId, input);

        var penalty = StaffPenalty.Create(
            GuidGenerator.Create(), branchId, input.StaffId, input.ViolationTypeId,
            input.ViolationDate, input.Action, input.FineAmount, input.Description, ClinicToday);

        await repository.InsertAsync(penalty, autoSave: true);
        return await GetAsync(penalty.Id);
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Update)]
    public async Task<StaffPenaltyDto> UpdateAsync(Guid id, UpdateStaffPenaltyDto input)
    {
        var penalty = await GetCheckedAsync(id);
        await CheckReferencesAsync(penalty.ClinicBranchId, input);

        penalty.Update(input.StaffId, input.ViolationTypeId, input.ViolationDate,
            input.Action, input.FineAmount, input.Description, ClinicToday);

        await repository.UpdateAsync(penalty, autoSave: true);
        return await GetAsync(id);
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var penalty = await GetCheckedAsync(id);
        penalty.EnsureDeletable();
        await repository.DeleteAsync(penalty, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Approve)]
    public async Task<StaffPenaltyDto> ApproveAsync(Guid id)
    {
        var penalty = await GetCheckedAsync(id);
        penalty.Approve(CurrentUser.GetId(), Clock.Now);
        await repository.UpdateAsync(penalty, autoSave: true);
        return await GetAsync(id);
    }

    /// <summary>
    /// Huỷ needs the approve right: cancelling an approved record undoes an
    /// approval, and a draft is withdrawn the same way to keep one rule.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.StaffPenalty.Approve)]
    public async Task<StaffPenaltyDto> CancelAsync(Guid id, CancelStaffPenaltyDto input)
    {
        var penalty = await GetCheckedAsync(id);
        penalty.Cancel(input.Reason, Clock.Now);
        await repository.UpdateAsync(penalty, autoSave: true);
        return await GetAsync(id);
    }

    private async Task<StaffPenalty> GetCheckedAsync(Guid id)
    {
        var penalty = await repository.GetAsync(id);
        await branchAccess.CheckAsync(penalty.ClinicBranchId);
        return penalty;
    }

    private async Task CheckReferencesAsync(Guid branchId, StaffPenaltyInputDto input)
    {
        var worksHere = await assignmentRepository.AnyAsync(
            a => a.StaffId == input.StaffId && a.ClinicBranchId == branchId);
        if (!worksHere)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.StaffNotInBranch);
        }

        if (input.ViolationTypeId is { } typeId)
        {
            var type = await typeRepository.FindAsync(typeId);
            if (type is null || type.ClinicBranchId != branchId)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.InvalidViolationType);
            }
        }
    }

    private async Task<List<StaffPenaltyDto>> MapAsync(IReadOnlyCollection<StaffPenalty> penalties)
    {
        var userIds = penalties
            .SelectMany(p => new[] { p.StaffId, p.ApproverId, p.CreatorId })
            .OfType<Guid>()
            .Distinct()
            .ToList();
        var names = (await userRepository.GetListByIdsAsync(userIds)).ToDictionary(u => u.Id, FullName);

        var typeIds = penalties.Select(p => p.ViolationTypeId).OfType<Guid>().Distinct().ToList();
        Dictionary<Guid, string> typeNames;
        // A type deleted after use still names the records filed under it.
        using (DataFilter.Disable<ISoftDelete>())
        {
            typeNames = (await typeRepository.GetListAsync(t => typeIds.Contains(t.Id)))
                .ToDictionary(t => t.Id, t => t.Name);
        }

        return penalties.Select(p => new StaffPenaltyDto
        {
            Id = p.Id,
            ClinicBranchId = p.ClinicBranchId,
            StaffId = p.StaffId,
            StaffName = names.GetValueOrDefault(p.StaffId),
            ViolationTypeId = p.ViolationTypeId,
            ViolationTypeName = p.ViolationTypeId is { } t ? typeNames.GetValueOrDefault(t) : null,
            ViolationDate = p.ViolationDate,
            Action = p.Action,
            FineAmount = p.FineAmount,
            Description = p.Description,
            Status = p.Status,
            ApproverId = p.ApproverId,
            ApproverName = p.ApproverId is { } a ? names.GetValueOrDefault(a) : null,
            ApprovedAt = p.ApprovedAt,
            CancelledAt = p.CancelledAt,
            CancelReason = p.CancelReason,
            CreatorId = p.CreatorId,
            CreatorName = p.CreatorId is { } c ? names.GetValueOrDefault(c) : null,
            CreationTime = p.CreationTime,
        }).ToList();
    }

    private static string FullName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}
