using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

[Authorize(BlueDentalPermissions.Staff.Default)]
public class StaffAppService(
    IIdentityUserRepository userRepository,
    IdentityUserManager userManager) : ApplicationService, IStaffAppService
{
    [Authorize(BlueDentalPermissions.Staff.View)]
    public async Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffListInput input)
    {
        var users = await userRepository.GetListAsync(
            sorting: input.Sorting ?? "Name",
            maxResultCount: input.MaxResultCount,
            skipCount: input.SkipCount,
            filter: input.Filter);

        var totalCount = await userRepository.GetCountAsync(filter: input.Filter);

        var dtos = new List<StaffDto>();
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            dtos.Add(new StaffDto
            {
                Id = user.Id,
                UserName = user.UserName ?? string.Empty,
                Name = user.Name,
                Surname = user.Surname,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                IsActive = user.IsActive,
                RoleNames = roles.ToList(),
            });
        }

        return new PagedResultDto<StaffDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Staff.View)]
    public async Task<StaffDto> GetAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var roles = await userManager.GetRolesAsync(user);
        return new StaffDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Name = user.Name,
            Surname = user.Surname,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            IsActive = user.IsActive,
            RoleNames = roles.ToList(),
        };
    }
}
