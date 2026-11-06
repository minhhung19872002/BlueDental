using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;
using Volo.Abp.Identity;
using Volo.Abp.Linq;

namespace BlueDental.Chat;

/// <summary>
/// Who may take part in a conversation of a branch — the single place that
/// decides it (F-89, owner 2026-11-06: "chat trong chi nhánh, sau này mở rộng").
///
/// Today: an active account that works in the branch, i.e. is assigned to it
/// or has no assignment at all (clinic-wide, see <see cref="BranchAccessChecker"/>).
/// Opening chat across branches later means widening this query; conversations
/// and messages are read by membership, so nothing else has to change.
/// </summary>
public class ChatParticipantPolicy : IDomainService
{
    private readonly IRepository<IdentityUser, Guid> _users;
    private readonly IRepository<StaffBranchAssignment, Guid> _assignments;
    private readonly IAsyncQueryableExecuter _asyncExecuter;

    public ChatParticipantPolicy(
        IRepository<IdentityUser, Guid> users,
        IRepository<StaffBranchAssignment, Guid> assignments,
        IAsyncQueryableExecuter asyncExecuter)
    {
        _users = users;
        _assignments = assignments;
        _asyncExecuter = asyncExecuter;
    }

    public async Task<IQueryable<IdentityUser>> GetEligibleQueryAsync(Guid clinicBranchId)
    {
        var users = await _users.GetQueryableAsync();
        var assignments = await _assignments.GetQueryableAsync();

        return users.Where(u => u.IsActive
            && (assignments.Any(a => a.StaffId == u.Id && a.ClinicBranchId == clinicBranchId)
                || !assignments.Any(a => a.StaffId == u.Id)));
    }

    /// <summary>Throws when any of the given people cannot chat in the branch.</summary>
    public async Task EnsureEligibleAsync(Guid clinicBranchId, IReadOnlyCollection<Guid> userIds)
    {
        var wanted = userIds.Distinct().ToList();
        if (wanted.Count == 0)
        {
            return;
        }

        var query = await GetEligibleQueryAsync(clinicBranchId);
        var found = await _asyncExecuter.CountAsync(query.Where(u => wanted.Contains(u.Id)));
        if (found != wanted.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.MemberNotInBranch);
        }
    }
}
