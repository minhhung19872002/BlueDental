using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Identity;
using Volo.Abp.Identity;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Staff;

[Authorize(BlueDentalPermissions.Staff.Default)]
public class StaffAppService(
    IIdentityUserRepository userRepository,
    IdentityUserManager userManager,
    IIdentityRoleRepository roleRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IBlobContainer blobContainer) : ApplicationService, IStaffAppService
{
    private const long MaxAvatarBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedContentTypes = ["image/png", "image/jpeg", "image/webp"];
    // Vietnamese mobile number: starts with 0, exactly 10 digits.
    private static readonly Regex PhoneRegex = new(@"^0\d{9}$", RegexOptions.Compiled);

    // "HH:mm" — 00:00 to 23:59.
    private static readonly Regex TimeRegex = new(@"^([01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);

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
            dtos.Add(await MapAsync(user));
        }

        return new PagedResultDto<StaffDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Staff.View)]
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
        ValidateExtendedFields(input.PhoneNumber, input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

        var existingByEmail = await userRepository.FindByNormalizedEmailAsync(input.Email.ToUpperInvariant());
        if (existingByEmail is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.DuplicateEmail);
        }

        var userName = await GenerateUniqueUserNameAsync(input.UserName, input.Email);

        var user = new Volo.Abp.Identity.IdentityUser(GuidGenerator.Create(), userName, input.Email)
        {
            Name = input.Name,
            Surname = input.Surname
        };

        if (!input.PhoneNumber.IsNullOrWhiteSpace())
        {
            user.SetPhoneNumber(input.PhoneNumber, confirmed: false);
        }

        SetExtraProperties(user, input.Address, input.ProvinceId, input.DistrictId, input.WardId,
            input.IsDentist, input.IsAssistant, input.IsHygienist,
            input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

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
        ValidateExtendedFields(input.PhoneNumber, input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

        var user = await userRepository.GetAsync(id);

        user.Name = input.Name;
        user.Surname = input.Surname;
        user.SetIsActive(input.IsActive);
        (await userManager.SetEmailAsync(user, input.Email)).CheckErrors();
        (await userManager.SetPhoneNumberAsync(user, input.PhoneNumber)).CheckErrors();

        SetExtraProperties(user, input.Address, input.ProvinceId, input.DistrictId, input.WardId,
            input.IsDentist, input.IsAssistant, input.IsHygienist,
            input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

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

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
    public async Task<AvatarResultDto> UploadAvatarAsync(Guid id, RemoteStreamContent file)
    {
        if (file == null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarFileRequired, "No file uploaded.");

        var contentType = file.ContentType ?? string.Empty;
        if (!AllowedContentTypes.Contains(contentType))
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.UnsupportedAvatarType, "Only PNG, JPEG, and WebP images are allowed.");

        var user = await userRepository.GetAsync(id);

        using var buffer = new MemoryStream();
        await file.GetStream().CopyToAsync(buffer);

        if (buffer.Length > MaxAvatarBytes)
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarTooLarge, "Avatar file must be 5 MB or smaller.");

        var ext = contentType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };

        // Delete previous avatar blob if exists
        var previousBlob = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;
        if (!previousBlob.IsNullOrWhiteSpace())
        {
            await blobContainer.DeleteAsync(previousBlob!);
        }

        var blobName = $"staff/avatars/{id}{ext}";
        buffer.Position = 0;
        await blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        user.ExtraProperties["AvatarBlobName"] = blobName;
        (await userManager.UpdateAsync(user)).CheckErrors();

        var url = $"/api/v1/app/staff/{id}/avatar";
        return new AvatarResultDto { Url = url };
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
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

    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<Stream> GetAvatarContentAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var blobName = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;

        if (blobName.IsNullOrWhiteSpace())
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarNotFound, "No avatar found.");

        return await blobContainer.GetAsync(blobName!);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async Task<string> GenerateUniqueUserNameAsync(string? preferredUserName, string email)
    {
        var baseName = !preferredUserName.IsNullOrWhiteSpace()
            ? preferredUserName!
            : email.Split('@')[0];

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

    private static void ValidateExtendedFields(
        string? phoneNumber,
        string? morningStartTime,
        string? morningEndTime,
        string? afternoonStartTime,
        string? afternoonEndTime)
    {
        if (!phoneNumber.IsNullOrWhiteSpace() && !PhoneRegex.IsMatch(phoneNumber!))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidPhoneNumber)
                .WithData("phoneNumber", phoneNumber);
        }

        foreach (var (label, value) in new[]
        {
            ("morningStartTime",   morningStartTime),
            ("morningEndTime",     morningEndTime),
            ("afternoonStartTime", afternoonStartTime),
            ("afternoonEndTime",   afternoonEndTime),
        })
        {
            if (!value.IsNullOrWhiteSpace() && !TimeRegex.IsMatch(value!))
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidTimeFormat)
                    .WithData("field", label)
                    .WithData("value", value);
            }
        }
    }

    /// <summary>
    /// Writes all 11 extended-profile fields as ExtraProperties on the IdentityUser.
    /// Null/empty strings are stored as null so reads can use a clean null-check.
    /// </summary>
    private static void SetExtraProperties(
        Volo.Abp.Identity.IdentityUser user,
        string? address,
        string? provinceId,
        string? districtId,
        string? wardId,
        bool isDentist,
        bool isAssistant,
        bool isHygienist,
        string? morningStartTime,
        string? morningEndTime,
        string? afternoonStartTime,
        string? afternoonEndTime)
    {
        user.ExtraProperties["Address"]           = address.IsNullOrWhiteSpace() ? null : address;
        user.ExtraProperties["ProvinceId"]        = provinceId.IsNullOrWhiteSpace() ? null : provinceId;
        user.ExtraProperties["DistrictId"]        = districtId.IsNullOrWhiteSpace() ? null : districtId;
        user.ExtraProperties["WardId"]            = wardId.IsNullOrWhiteSpace() ? null : wardId;
        user.ExtraProperties["IsDentist"]         = isDentist;
        user.ExtraProperties["IsAssistant"]       = isAssistant;
        user.ExtraProperties["IsHygienist"]       = isHygienist;
        user.ExtraProperties["MorningStartTime"]  = morningStartTime.IsNullOrWhiteSpace() ? null : morningStartTime;
        user.ExtraProperties["MorningEndTime"]    = morningEndTime.IsNullOrWhiteSpace() ? null : morningEndTime;
        user.ExtraProperties["AfternoonStartTime"] = afternoonStartTime.IsNullOrWhiteSpace() ? null : afternoonStartTime;
        user.ExtraProperties["AfternoonEndTime"]  = afternoonEndTime.IsNullOrWhiteSpace() ? null : afternoonEndTime;
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
            BranchIds = assignments.Select(a => a.ClinicBranchId).ToList(),

            // Extended profile — read back from ExtraProperties
            Address            = user.ExtraProperties.GetOrDefault("Address") as string,
            ProvinceId         = user.ExtraProperties.GetOrDefault("ProvinceId") as string,
            DistrictId         = user.ExtraProperties.GetOrDefault("DistrictId") as string,
            WardId             = user.ExtraProperties.GetOrDefault("WardId") as string,
            IsDentist          = user.ExtraProperties.GetOrDefault("IsDentist") is true,
            IsAssistant        = user.ExtraProperties.GetOrDefault("IsAssistant") is true,
            IsHygienist        = user.ExtraProperties.GetOrDefault("IsHygienist") is true,
            MorningStartTime   = user.ExtraProperties.GetOrDefault("MorningStartTime") as string,
            MorningEndTime     = user.ExtraProperties.GetOrDefault("MorningEndTime") as string,
            AfternoonStartTime = user.ExtraProperties.GetOrDefault("AfternoonStartTime") as string,
            AfternoonEndTime   = user.ExtraProperties.GetOrDefault("AfternoonEndTime") as string,
            AvatarUrl          = (user.ExtraProperties.GetOrDefault("AvatarBlobName") as string) is not null
                                     ? $"/api/v1/app/staff/{user.Id}/avatar"
                                     : null,
        };
    }
}
