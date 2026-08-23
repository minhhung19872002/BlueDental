using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp;
using Volo.Abp.Application.Services;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Identity;
using Volo.Abp.Identity;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Staff;

[Authorize]
public class StaffAppService(
    IIdentityUserRepository userRepository,
    IdentityUserManager userManager,
    IIdentityRoleRepository roleRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository) : ApplicationService, IStaffAppService
{
    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
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
            dtos.Add(await MapAsync(user));
        }

        return new PagedResultDto<StaffDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<StaffDto> GetAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<List<string>> GetRoleNamesAsync()
    {
        var roles = await roleRepository.GetListAsync();
        return roles.Select(r => r.Name).OrderBy(name => name).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Create)]
    public async Task<StaffDto> CreateAsync(CreateStaffDto input)
    {
        var user = new Volo.Abp.Identity.IdentityUser(GuidGenerator.Create(), input.UserName, input.Email)
        {
            Name = input.Name,
            Surname = input.Surname
        };

        if (!input.PhoneNumber.IsNullOrWhiteSpace())
        {
            user.SetPhoneNumber(input.PhoneNumber, confirmed: false);
        }

        (await userManager.CreateAsync(user, input.Password)).CheckErrors();

        if (input.RoleNames.Count > 0)
        {
            (await userManager.AddToRolesAsync(user, input.RoleNames)).CheckErrors();
        }

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
    public async Task<StaffDto> UpdateAsync(Guid id, UpdateStaffDto input)
    {
        var user = await userRepository.GetAsync(id);

        user.Name = input.Name;
        user.Surname = input.Surname;
        user.SetIsActive(input.IsActive);
        (await userManager.SetEmailAsync(user, input.Email)).CheckErrors();
        (await userManager.SetPhoneNumberAsync(user, input.PhoneNumber)).CheckErrors();

        // Roles are replaced wholesale: the form shows the full set, not a delta.
        var current = await userManager.GetRolesAsync(user);
        (await userManager.RemoveFromRolesAsync(user, current)).CheckErrors();
        if (input.RoleNames.Count > 0)
        {
            (await userManager.AddToRolesAsync(user, input.RoleNames)).CheckErrors();
        }

        (await userManager.UpdateAsync(user)).CheckErrors();

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        if (CurrentUser.Id == id)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Organizations.CannotDeleteActiveClinic,
                "You cannot delete the account you are signed in with.");
        }

        var user = await userRepository.GetAsync(id);

        // Leaving the assignments behind would silently re-scope a recreated user.
        await ReplaceBranchAssignmentsAsync(id, []);
        (await userManager.DeleteAsync(user)).CheckErrors();
    }

    private async Task ReplaceBranchAssignmentsAsync(Guid staffId, List<Guid> branchIds)
    {
        var existing = await assignmentRepository.GetListAsync(a => a.StaffId == staffId);
        if (existing.Count > 0)
        {
            await assignmentRepository.DeleteManyAsync(existing, autoSave: true);
        }

        foreach (var branchId in branchIds.Distinct())
        {
            await assignmentRepository.InsertAsync(
                StaffBranchAssignment.Assign(GuidGenerator.Create(), staffId, branchId),
                autoSave: true);
        }
    }

    private async Task<StaffDto> MapAsync(Volo.Abp.Identity.IdentityUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var assignments = await assignmentRepository.GetListAsync(a => a.StaffId == user.Id);

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
            BranchIds = assignments.Select(a => a.ClinicBranchId).ToList()
        };
    }
}
