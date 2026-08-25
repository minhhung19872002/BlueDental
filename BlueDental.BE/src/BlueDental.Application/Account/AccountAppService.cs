using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Account;

[Authorize]
public class AccountAppService(
    IdentityUserManager userManager,
    ICurrentClinicBranchResolver branchResolver,
    IRepository<ClinicBranch, Guid> branchRepository) : ApplicationService, IAccountAppService
{
    public async Task<CurrentUserDto> GetCurrentUserAsync()
    {
        var userId = CurrentUser.Id
            ?? throw new BusinessException("BlueDental:Auth:NotAuthenticated");

        var user = await userManager.GetByIdAsync(userId);
        var roles = await userManager.GetRolesAsync(user);

        var clinicId = branchResolver.ClinicBranchId;
        string? clinicName = null;

        string? clinicTagline = null;

        if (clinicId.HasValue)
        {
            var branch = await branchRepository.FindAsync(clinicId.Value);
            clinicName = branch?.Name;
            clinicTagline = branch?.Slogan;
        }

        return new CurrentUserDto
        {
            Id = userId,
            UserName = user.UserName ?? string.Empty,
            Name = user.Name ?? user.UserName ?? string.Empty,
            Email = user.Email,
            ClinicId = clinicId,
            ClinicName = clinicName,
            ClinicLogoUrl = null,
            ClinicTagline = clinicTagline,
            Roles = roles.ToList(),
            Permissions = [],
            PasswordMustChange = false,
        };
    }

    public async Task ChangePasswordAsync(ChangePasswordInput input)
    {
        var userId = CurrentUser.Id
            ?? throw new BusinessException("BlueDental:Auth:NotAuthenticated");

        var user = await userManager.GetByIdAsync(userId);
        var result = await userManager.ChangePasswordAsync(user, input.CurrentPassword, input.NewPassword);

        if (!result.Succeeded)
        {
            throw new BusinessException("BlueDental:Auth:ChangePasswordFailed")
                .WithData("errors", string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
}
