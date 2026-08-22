using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Identity;

namespace BlueDental.Account;

[Authorize]
public class AccountAppService(
    IdentityUserManager userManager,
    IIdentityUserRepository userRepository) : ApplicationService, IAccountAppService
{
    public async Task<CurrentUserDto> GetCurrentUserAsync()
    {
        var userId = CurrentUser.Id
            ?? throw new BusinessException("BlueDental:Auth:NotAuthenticated");

        var user = await userManager.GetByIdAsync(userId);
        var roles = await userManager.GetRolesAsync(user);

        return new CurrentUserDto
        {
            Id = userId,
            UserName = user.UserName ?? string.Empty,
            Name = user.Name ?? user.UserName ?? string.Empty,
            Email = user.Email,
            ClinicId = null,
            ClinicName = null,
            ClinicLogoUrl = null,
            ClinicTagline = null,
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
