using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Http;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Uow;

namespace BlueDental.Account;

/// <summary>
/// Loads what <see cref="LoginIpPolicy"/> needs for one account and answers
/// it. Called at sign-in and, through a short cache, on every authenticated
/// request so a session cannot carry on from outside the office.
/// </summary>
public class LoginIpGuard(
    IdentityUserManager userManager,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IRepository<ClinicBranch, Guid> branchRepository,
    IHttpContextAccessor httpContextAccessor,
    IUnitOfWorkManager unitOfWorkManager) : ITransientDependency
{
    /// <summary>The caller's address as the server sees it, IPv4-mapped addresses unwrapped.</summary>
    public IPAddress? ClientAddress
    {
        get
        {
            var address = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress;
            return address is null ? null : IpAddressRange.Normalize(address);
        }
    }

    public Task<bool> IsAllowedAsync(IdentityUser user) => IsAllowedAsync(user, ClientAddress);

    public async Task<bool> IsAllowedAsync(Guid userId, IPAddress? clientAddress)
    {
        // API requests run without an ambient unit of work (see the host's
        // ConfigureUnitOfWork), and the per-request check runs before MVC.
        using var uow = unitOfWorkManager.Begin(requiresNew: false, isTransactional: false);

        var user = await userManager.FindByIdAsync(userId.ToString());
        var allowed = user is null || await IsAllowedAsync(user, clientAddress);

        await uow.CompleteAsync();
        return allowed;
    }

    public async Task<bool> IsAllowedAsync(IdentityUser user, IPAddress? clientAddress)
    {
        using var uow = unitOfWorkManager.Begin(requiresNew: false, isTransactional: false);

        var exempt = user.ExtraProperties.GetOrDefault(BlueDentalConsts.UserAllowLoginOutsideOfficePropertyName) is true
            || await userManager.IsInRoleAsync(user, BlueDentalAbilitySeedContributor.AdminRoleName);

        var allowed = LoginIpPolicy.IsAllowed(
            exempt, exempt ? [] : await GetAccountBranchesAsync(user), clientAddress);

        await uow.CompleteAsync();
        return allowed;
    }

    /// <summary>
    /// The branches the account works in, resolved the way branch scope is:
    /// its assignments, else the home-branch property, else — clinic-wide
    /// account — every branch.
    /// </summary>
    private async Task<List<ClinicBranch>> GetAccountBranchesAsync(IdentityUser user)
    {
        var branchIds = (await assignmentRepository.GetListAsync(a => a.StaffId == user.Id))
            .Select(a => a.ClinicBranchId)
            .ToHashSet();

        if (branchIds.Count == 0
            && Guid.TryParse(user.ExtraProperties.GetOrDefault(BlueDentalConsts.UserClinicBranchIdPropertyName)?.ToString(), out var home))
        {
            branchIds.Add(home);
        }

        return branchIds.Count == 0
            ? await branchRepository.GetListAsync()
            : await branchRepository.GetListAsync(b => branchIds.Contains(b.Id));
    }
}
