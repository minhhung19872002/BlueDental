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

/// <summary>Why an account may not sign in or keep its session right now.</summary>
/// <param name="Code">The error code the client is answered with.</param>
/// <param name="Hours">For <c>LoginOutsideHours</c>, the windows that apply ("06:00–20:00").</param>
public sealed record SignInRefusal(string Code, string? Hours = null);

/// <summary>
/// Loads what <see cref="LoginIpPolicy"/> (Cụm 11 mục 11) and
/// <see cref="UsageHoursPolicy"/> (mục 13) need for one account and answers
/// them. Called at sign-in and, through a short cache, on every authenticated
/// request, so a session cannot carry on from outside the office or past the
/// end of the allowed hours.
/// </summary>
public class SignInRestrictionGuard(
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

    public Task<SignInRefusal?> CheckAsync(IdentityUser user) =>
        CheckAsync(user, ClientAddress, DateTimeOffset.UtcNow);

    public async Task<SignInRefusal?> CheckAsync(Guid userId, IPAddress? clientAddress, DateTimeOffset now)
    {
        // API requests run without an ambient unit of work (see the host's
        // ConfigureUnitOfWork), and the per-request check runs before MVC.
        using var uow = unitOfWorkManager.Begin(requiresNew: false, isTransactional: false);

        var user = await userManager.FindByIdAsync(userId.ToString());
        var refusal = user is null ? null : await CheckAsync(user, clientAddress, now);

        await uow.CompleteAsync();
        return refusal;
    }

    public async Task<SignInRefusal?> CheckAsync(IdentityUser user, IPAddress? clientAddress, DateTimeOffset now)
    {
        using var uow = unitOfWorkManager.Begin(requiresNew: false, isTransactional: false);

        var refusal = await EvaluateAsync(user, clientAddress, now);

        await uow.CompleteAsync();
        return refusal;
    }

    private async Task<SignInRefusal?> EvaluateAsync(IdentityUser user, IPAddress? clientAddress, DateTimeOffset now)
    {
        if (await userManager.IsInRoleAsync(user, BlueDentalAbilitySeedContributor.AdminRoleName))
            return null;

        var ipExempt = IsTicked(user, BlueDentalConsts.UserAllowLoginOutsideOfficePropertyName);
        var hoursExempt = IsTicked(user, BlueDentalConsts.UserAllowLoginOutsideHoursPropertyName);
        if (ipExempt && hoursExempt) return null;

        var branches = await GetAccountBranchesAsync(user);

        if (!LoginIpPolicy.IsAllowed(ipExempt, branches, clientAddress))
            return new SignInRefusal(BlueDentalDomainErrorCodes.Authentication.LoginIpNotAllowed);

        var clinicTime = TimeOnly.FromDateTime(ClinicCalendar.ToLocal(now).DateTime);
        if (!UsageHoursPolicy.IsAllowed(hoursExempt, branches, clinicTime))
        {
            return new SignInRefusal(
                BlueDentalDomainErrorCodes.Authentication.LoginOutsideHours,
                UsageHoursPolicy.Describe(branches));
        }

        return null;
    }

    private static bool IsTicked(IdentityUser user, string property) =>
        user.ExtraProperties.GetOrDefault(property) is true;

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
