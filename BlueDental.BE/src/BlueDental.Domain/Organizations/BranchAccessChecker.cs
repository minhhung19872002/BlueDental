using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.Authorization;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;
using Volo.Abp.Users;

namespace BlueDental.Organizations;

/// <summary>
/// Resolves and enforces which clinic branches the current user may touch.
///
/// Every business entity carries a <c>ClinicBranchId</c>, and the reference
/// scopes every call by <c>branchId</c>. Without a check, passing another
/// branch's id would happily read or write that branch's data — permissions
/// alone do not stop it, because the ability model says *what* you may do, not
/// *where*.
///
/// Rule: a staff member with at least one <see cref="StaffBranchAssignment"/> is
/// restricted to those branches. A staff member with none is clinic-wide, which
/// is how back-office and clinic-admin accounts work.
/// </summary>
public class BranchAccessChecker : IDomainService
{
    private readonly IRepository<StaffBranchAssignment, Guid> _assignments;
    private readonly ICurrentUser _currentUser;

    public BranchAccessChecker(
        IRepository<StaffBranchAssignment, Guid> assignments,
        ICurrentUser currentUser)
    {
        _assignments = assignments;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Branches the current user is limited to. An empty list means "no limit",
    /// not "no access".
    /// </summary>
    public async Task<IReadOnlyList<Guid>> GetAllowedBranchIdsAsync()
    {
        var userId = _currentUser.Id;

        if (userId is null)
        {
            return Array.Empty<Guid>();
        }

        var query = await _assignments.GetQueryableAsync();

        return query
            .Where(a => a.StaffId == userId.Value)
            .Select(a => a.ClinicBranchId)
            .Distinct()
            .ToList();
    }

    public async Task<bool> IsAllowedAsync(Guid clinicBranchId)
    {
        var allowed = await GetAllowedBranchIdsAsync();

        return allowed.Count == 0 || allowed.Contains(clinicBranchId);
    }

    /// <summary>Throws when the current user may not act on the given branch.</summary>
    public async Task CheckAsync(Guid clinicBranchId)
    {
        if (!await IsAllowedAsync(clinicBranchId))
        {
            throw new AbpAuthorizationException(
                $"Tài khoản này không được phép truy cập dữ liệu của chi nhánh {clinicBranchId}.");
        }
    }

    /// <summary>
    /// The branch a write should land in.
    ///
    /// The client names it, because the header lets the user switch branches,
    /// and it is honoured only when the account may act there. Callers that send
    /// nothing keep landing in their own branch, which is what every screen did
    /// before the switcher existed.
    /// </summary>
    public async Task<Guid> ResolveWriteTargetAsync(Guid requestedBranchId, Guid ownBranchId)
    {
        var target = requestedBranchId == Guid.Empty ? ownBranchId : requestedBranchId;
        await CheckAsync(target);
        return target;
    }

    /// <summary>
    /// Narrows a requested branch filter to what the user may see. Returns the
    /// requested branch when allowed, or the user's own branches when the caller
    /// did not name one; an empty result means "all branches".
    /// </summary>
    public async Task<IReadOnlyList<Guid>> ResolveFilterAsync(Guid? requestedBranchId)
    {
        var allowed = await GetAllowedBranchIdsAsync();

        if (requestedBranchId is null)
        {
            return allowed;
        }

        await CheckAsync(requestedBranchId.Value);
        return [requestedBranchId.Value];
    }
}
