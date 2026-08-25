using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.BranchManager;

[Authorize(BlueDentalPermissions.BranchManager.Default)]
public class BranchManagerAppService(
    IIdentityUserRepository userRepository,
    IdentityUserManager userManager,
    IRepository<BranchManagerAssignment, Guid> assignmentRepository,
    IBlobContainer blobContainer) : ApplicationService, IBranchManagerAppService
{
    private const long MaxAvatarBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes = ["image/png", "image/jpeg", "image/webp"];
    private static readonly Regex PhoneRegex = new(@"^0\d{9}$", RegexOptions.Compiled);

    [Authorize(BlueDentalPermissions.BranchManager.View)]
    public async Task<PagedResultDto<BranchManagerDto>> GetListAsync(GetBranchManagerListInput input)
    {
        HashSet<Guid>? branchManagerIds = null;
        if (input.BranchId.HasValue)
        {
            var assignments = await assignmentRepository.GetListAsync(
                a => a.ClinicBranchId == input.BranchId.Value);
            branchManagerIds = assignments.Select(a => a.ManagerId).ToHashSet();
        }

        var users = await userRepository.GetListAsync(
            sorting: input.Sorting ?? "Name",
            maxResultCount: int.MaxValue,
            skipCount: 0,
            filter: input.Filter);

        // Only include users tagged as branch managers
        users = users.Where(u => u.ExtraProperties.GetOrDefault("IsBranchManager") is true).ToList();

        if (branchManagerIds != null)
        {
            users = users.Where(u => branchManagerIds.Contains(u.Id)).ToList();
        }

        var totalCount = users.Count;
        var paged = users.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var dtos = new List<BranchManagerDto>();
        foreach (var user in paged)
        {
            dtos.Add(await MapAsync(user));
        }

        return new PagedResultDto<BranchManagerDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.BranchManager.View)]
    public async Task<BranchManagerDto> GetAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Create)]
    public async Task<BranchManagerDto> CreateAsync(CreateBranchManagerDto input)
    {
        if (!PhoneRegex.IsMatch(input.PhoneNumber))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.InvalidPhoneNumber)
                .WithData("phoneNumber", input.PhoneNumber);
        }

        var existingByEmail = await userRepository.FindByNormalizedEmailAsync(input.Email.ToUpperInvariant());
        if (existingByEmail is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.DuplicateEmail);
        }

        var userName = await GenerateUniqueUserNameAsync(input.Email);

        var user = new Volo.Abp.Identity.IdentityUser(GuidGenerator.Create(), userName, input.Email)
        {
            Name = input.Name
        };

        user.SetPhoneNumber(input.PhoneNumber, confirmed: false);
        SetExtraProperties(user, input.Address, input.ProvinceId, input.WardId);
        user.ExtraProperties["IsBranchManager"] = true;

        (await userManager.CreateAsync(user, input.Password)).CheckErrors();

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Update)]
    public async Task<BranchManagerDto> UpdateAsync(Guid id, UpdateBranchManagerDto input)
    {
        if (!PhoneRegex.IsMatch(input.PhoneNumber))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.InvalidPhoneNumber)
                .WithData("phoneNumber", input.PhoneNumber);
        }

        var user = await userRepository.GetAsync(id);

        user.Name = input.Name;
        (await userManager.SetEmailAsync(user, input.Email)).CheckErrors();
        (await userManager.SetPhoneNumberAsync(user, input.PhoneNumber)).CheckErrors();

        SetExtraProperties(user, input.Address, input.ProvinceId, input.WardId);

        (await userManager.UpdateAsync(user)).CheckErrors();

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        if (CurrentUser.Id == id)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Organizations.CannotDeleteActiveClinic,
                "You cannot delete the account you are signed in with.");
        }

        var user = await userRepository.GetAsync(id);
        await ReplaceBranchAssignmentsAsync(id, []);
        (await userManager.DeleteAsync(user)).CheckErrors();
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Update)]
    public async Task<AvatarResultDto> UploadAvatarAsync(Guid id, RemoteStreamContent file)
    {
        if (file == null)
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.AvatarFileRequired);

        var contentType = file.ContentType ?? string.Empty;
        if (!AllowedContentTypes.Contains(contentType))
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.UnsupportedAvatarType);

        var user = await userRepository.GetAsync(id);

        using var buffer = new MemoryStream();
        await file.GetStream().CopyToAsync(buffer);

        if (buffer.Length > MaxAvatarBytes)
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.AvatarTooLarge);

        var ext = contentType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };

        var previousBlob = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;
        if (!previousBlob.IsNullOrWhiteSpace())
        {
            await blobContainer.DeleteAsync(previousBlob!);
        }

        var blobName = $"branch-managers/avatars/{id}{ext}";
        buffer.Position = 0;
        await blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        user.ExtraProperties["AvatarBlobName"] = blobName;
        (await userManager.UpdateAsync(user)).CheckErrors();

        return new AvatarResultDto { Url = $"/api/v1/app/branch-managers/{id}/avatar" };
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Update)]
    public async Task DeleteAvatarAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var blobName = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;

        if (!blobName.IsNullOrWhiteSpace())
        {
            await blobContainer.DeleteAsync(blobName!);
            user.ExtraProperties["AvatarBlobName"] = null;
            (await userManager.UpdateAsync(user)).CheckErrors();
        }
    }

    [Authorize(BlueDentalAbilityPermissions.BranchManager.Read)]
    public async Task<Stream> GetAvatarContentAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var blobName = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;

        if (blobName.IsNullOrWhiteSpace())
            throw new BusinessException(BlueDentalDomainErrorCodes.BranchManager.AvatarNotFound);

        return await blobContainer.GetAsync(blobName!);
    }

    private async Task<string> GenerateUniqueUserNameAsync(string email)
    {
        var baseName = email.Split('@')[0];
        var candidate = baseName;
        var suffix = 1;
        while (await userRepository.FindByNormalizedUserNameAsync(
                   candidate.ToUpperInvariant()) is not null)
        {
            candidate = $"{baseName}{suffix}";
            suffix++;
        }
        return candidate;
    }

    private static void SetExtraProperties(
        Volo.Abp.Identity.IdentityUser user,
        string? address,
        string? provinceId,
        string? wardId)
    {
        user.ExtraProperties["Address"]    = address.IsNullOrWhiteSpace() ? null : address;
        user.ExtraProperties["ProvinceId"] = provinceId.IsNullOrWhiteSpace() ? null : provinceId;
        user.ExtraProperties["WardId"]     = wardId.IsNullOrWhiteSpace() ? null : wardId;
    }

    private async Task ReplaceBranchAssignmentsAsync(Guid managerId, List<Guid> branchIds)
    {
        var existing = await assignmentRepository.GetListAsync(a => a.ManagerId == managerId);
        if (existing.Count > 0)
        {
            await assignmentRepository.DeleteManyAsync(existing, autoSave: true);
        }

        foreach (var branchId in branchIds.Distinct())
        {
            await assignmentRepository.InsertAsync(
                BranchManagerAssignment.Assign(GuidGenerator.Create(), managerId, branchId),
                autoSave: true);
        }
    }

    private async Task<BranchManagerDto> MapAsync(Volo.Abp.Identity.IdentityUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var assignments = await assignmentRepository.GetListAsync(a => a.ManagerId == user.Id);

        return new BranchManagerDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Name = user.Name,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            RoleNames = roles.ToList(),
            BranchIds = assignments.Select(a => a.ClinicBranchId).ToList(),
            Address = user.ExtraProperties.GetOrDefault("Address") as string,
            ProvinceId = user.ExtraProperties.GetOrDefault("ProvinceId") as string,
            WardId = user.ExtraProperties.GetOrDefault("WardId") as string,
            AvatarUrl = (user.ExtraProperties.GetOrDefault("AvatarBlobName") as string) is not null
                            ? $"/api/v1/app/branch-managers/{user.Id}/avatar"
                            : null,
        };
    }
}
